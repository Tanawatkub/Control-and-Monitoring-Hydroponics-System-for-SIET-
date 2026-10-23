#pragma once
#include <Arduino.h>
#include <PubSubClient.h>

// ================= pH Sensor PH-4502C =================
// Po -> GPIO35 (ช่อง Spare 1 บน PCB), VCC -> 3V3 เท่านั้น, GND -> GND
// ห้ามจ่าย 5V เพราะขา Po จะขึ้นเกิน 3.3V และทำให้ ADC ของ ESP32 เสียหาย
static const int PH_PIN = 35;
static const unsigned long PH_READ_MS = 1000;     // อ่านทุก 1 วินาที
static const unsigned long PH_REPORT_MS = 5000;   // แสดง/ส่ง MQTT ทุก 5 วินาที
static const int PH_HIST = 5;                     // median ของ 5 รอบล่าสุด
static const char *PH_TOPIC = "farm/ph/data";

// ช่วงแรงดันที่ถือว่าเซนเซอร์ต่ออยู่จริง (ตามตาราง calibrate pH 0-14 อยู่ราว 1.6-3.4 V)
// นอกช่วงนี้ = สายหลุด/ยังไม่ได้ต่อโมดูล ไม่รายงานค่า pH
static const float PH_V_MIN = 1.0f;
static const float PH_V_MAX = 3.3f;

// ----- ตารางสอบเทียบ 3 จุด (ค่าเดิมที่ calibrate แล้ว ห้ามแก้) -----
// แรงดัน V -> pH เรียงจากแรงดันต่ำไปสูง ใช้ช่วงละเส้นตรง
static const int PH_N_CAL = 3;
static const float PH_CAL_V[PH_N_CAL]  = {2.318f, 2.646f, 2.963f};
static const float PH_CAL_PH[PH_N_CAL] = {9.18f,  6.86f,  4.00f};

static float phHist[PH_HIST];
static int phHistCount = 0;
static int phHistIdx = 0;

static float voltageToPh(float v) {
  // เลือกช่วงที่ครอบแรงดัน (นอกช่วงจะต่อเส้นตรงจากช่วงปลายสุด)
  int i = 0;
  while (i < PH_N_CAL - 2 && v > PH_CAL_V[i + 1]) i++;
  float slope = (PH_CAL_PH[i + 1] - PH_CAL_PH[i]) / (PH_CAL_V[i + 1] - PH_CAL_V[i]);
  return PH_CAL_PH[i] + (v - PH_CAL_V[i]) * slope;
}

// อ่านเหมือนเดิมทุกอย่าง: เฉลี่ย 20 ครั้ง ห่าง 5 ms (วิธีเดียวกับตอน calibrate)
static float readPhVoltage() {
  long sum = 0;
  for (int i = 0; i < 20; i++) {
    sum += analogReadMilliVolts(PH_PIN);
    delay(5);
  }
  return (sum / 20.0) / 1000.0; // mV -> V
}

static void phSensorBegin() {
  analogSetPinAttenuation(PH_PIN, ADC_11db);
}

static float phMedianVoltage() {
  float tmp[PH_HIST];
  for (int i = 0; i < phHistCount; i++) tmp[i] = phHist[i];
  for (int i = 1; i < phHistCount; i++) {
    float key = tmp[i];
    int j = i - 1;
    while (j >= 0 && tmp[j] > key) {
      tmp[j + 1] = tmp[j];
      j--;
    }
    tmp[j + 1] = key;
  }
  return tmp[phHistCount / 2];
}

// เรียกใน loop() ทุกรอบ
static void phSensorLoop(PubSubClient &mqtt) {
  static unsigned long lastRead = 0;
  static unsigned long lastReport = 0;

  if (millis() - lastRead >= PH_READ_MS) {
    lastRead = millis();
    phHist[phHistIdx] = readPhVoltage();
    phHistIdx = (phHistIdx + 1) % PH_HIST;
    if (phHistCount < PH_HIST) phHistCount++;
  }

  if (phHistCount == 0 || millis() - lastReport < PH_REPORT_MS) return;
  lastReport = millis();

  float v = phMedianVoltage();

  if (v < PH_V_MIN || v > PH_V_MAX) {
    Serial.printf("pH: ไม่พบสัญญาณ (%.3f V) ตรวจสายโมดูล PH-4502C ขา Po -> GPIO35\n", v);
    if (mqtt.connected()) {
      char buf[64];
      snprintf(buf, sizeof(buf), "{\"v\":%.3f,\"valid\":0}", v);
      mqtt.publish(PH_TOPIC, buf);
    }
    return;
  }

  float ph = constrain(voltageToPh(v), 0.0f, 14.0f);
  Serial.printf("pH: %.2f (%.3f V)\n", ph, v);

  if (mqtt.connected()) {
    char buf[64];
    snprintf(buf, sizeof(buf), "{\"ph\":%.2f,\"v\":%.3f,\"valid\":1}", ph, v);
    mqtt.publish(PH_TOPIC, buf);
  }
}
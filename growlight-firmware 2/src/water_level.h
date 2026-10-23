#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ================= Analog Water Level Sensor =================
// ใช้ช่อง Soil Moisture บน PCB: A -> GPIO34 (ADC1), VCC -> 3.3V, GND -> GND
// (GPIO35 / Spare 1 ใช้กับเซนเซอร์ pH)
// WATER_POWER_PIN = -1 หมายถึงไม่ใช้ขาควบคุมไฟ (ห้ามใช้ GPIO27 เพราะเป็น Relay)
static const int WATER_PIN = 34;
static const int WATER_POWER_PIN = -1;

static const int WATER_SAMPLES = 32;                 // อ่านต่อรอบ 32 ครั้ง
static const int WATER_TRIM = 8;                     // ตัดสูง/ต่ำสุดฝั่งละ 8
static const int WATER_HIST = 5;                     // median ของ 5 รอบล่าสุด
static const unsigned long WATER_READ_MS = 1000;     // อ่านทุก 1 วินาที
static const unsigned long WATER_REPORT_MS = 5000;   // แสดง/ส่ง MQTT ทุก 5 วินาที
static const char *WATER_TOPIC = "farm/waterlevel/data";

// ตาราง calibrate แบบหลายจุด {mV, เปอร์เซ็นต์ระดับน้ำ} เรียงจาก mV น้อยไปมาก
// วัดจริงกับเซนเซอร์ลายหวียาว 4 cm (100% = จุ่มลึก 4 cm)
static const struct { int mv; float percent; } WATER_TABLE[] = {
  {142,  0.0f},    // แห้ง
  {1208, 12.5f},   // 0.5 cm
  {1346, 25.0f},   // 1.0 cm
  {1445, 37.5f},   // 1.5 cm
  {1540, 50.0f},   // 2.0 cm
  {1695, 62.5f},   // 2.5 cm
  {1765, 75.0f},   // 3.0 cm
  {1797, 87.5f},   // 3.5 cm
  {1886, 100.0f},  // 4.0 cm
};
static const int WATER_TABLE_N = sizeof(WATER_TABLE) / sizeof(WATER_TABLE[0]);

static int waterHist[WATER_HIST];
static int waterHistCount = 0;
static int waterHistIdx = 0;

static void waterLevelBegin() {
  if (WATER_POWER_PIN >= 0) {
    pinMode(WATER_POWER_PIN, OUTPUT);
    digitalWrite(WATER_POWER_PIN, LOW);
  }
  analogSetPinAttenuation(WATER_PIN, ADC_11db); // ช่วง ~0-3.1V
}

static void sortInts(int *a, int n) {
  for (int i = 1; i < n; i++) {
    int key = a[i], j = i - 1;
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = key;
  }
}

// อ่าน 32 ครั้ง (ห่าง 5 ms) เรียงค่า ตัดสูง/ต่ำสุดฝั่งละ 8 แล้วเฉลี่ยที่เหลือ
static int readWaterMv() {
  if (WATER_POWER_PIN >= 0) {
    digitalWrite(WATER_POWER_PIN, HIGH);
    delay(20);
  }

  int v[WATER_SAMPLES];
  for (int i = 0; i < WATER_SAMPLES; i++) {
    v[i] = analogReadMilliVolts(WATER_PIN);
    delay(5);
  }
  if (WATER_POWER_PIN >= 0) digitalWrite(WATER_POWER_PIN, LOW);

  sortInts(v, WATER_SAMPLES);

  long sum = 0;
  for (int i = WATER_TRIM; i < WATER_SAMPLES - WATER_TRIM; i++) sum += v[i];
  return (int)(sum / (WATER_SAMPLES - 2 * WATER_TRIM));
}

// แปลง mV เป็นเปอร์เซ็นต์ด้วยการประมาณเส้นตรงระหว่างจุดในตาราง
static float waterPercent(int mv) {
  if (mv <= WATER_TABLE[0].mv) return WATER_TABLE[0].percent;
  for (int i = 1; i < WATER_TABLE_N; i++) {
    if (mv <= WATER_TABLE[i].mv) {
      float span = WATER_TABLE[i].mv - WATER_TABLE[i - 1].mv;
      float frac = (mv - WATER_TABLE[i - 1].mv) / span;
      return WATER_TABLE[i - 1].percent +
             frac * (WATER_TABLE[i].percent - WATER_TABLE[i - 1].percent);
    }
  }
  return WATER_TABLE[WATER_TABLE_N - 1].percent;
}

// median ของค่าล่าสุดใน waterHist (กันค่ากระโดดเป็นครั้งคราว)
static int waterMedian() {
  int tmp[WATER_HIST];
  for (int i = 0; i < waterHistCount; i++) tmp[i] = waterHist[i];
  sortInts(tmp, waterHistCount);
  return tmp[waterHistCount / 2];
}

// เรียกใน loop() ทุกรอบ
static void waterLevelLoop(PubSubClient &mqtt) {
  static unsigned long lastRead = 0;
  static unsigned long lastReport = 0;

  if (millis() - lastRead >= WATER_READ_MS) {
    lastRead = millis();
    waterHist[waterHistIdx] = readWaterMv();
    waterHistIdx = (waterHistIdx + 1) % WATER_HIST;
    if (waterHistCount < WATER_HIST) waterHistCount++;
  }

  if (waterHistCount == 0 || millis() - lastReport < WATER_REPORT_MS) return;
  lastReport = millis();

  int mv = waterMedian();
  float pct = waterPercent(mv);

  // แสดงสถานะ WiFi / MQTT พร้อมระดับน้ำทุกครั้ง จะได้เห็นว่าเชื่อมต่ออยู่หรือไม่
  bool wifiOk = (WiFi.status() == WL_CONNECTED);
  Serial.printf("ระดับน้ำ: %d mV -> %.1f %% | WiFi: %s (%s) | MQTT: %s\n",
                mv, pct,
                wifiOk ? "OK" : "หลุด",
                wifiOk ? WiFi.localIP().toString().c_str() : "-",
                mqtt.connected() ? "OK" : "ไม่เชื่อมต่อ");

  if (mqtt.connected()) {
    char buf[96];
    snprintf(buf, sizeof(buf), "{\"mv\":%d,\"percent\":%.1f}", mv, pct);
    mqtt.publish(WATER_TOPIC, buf);
  }
}
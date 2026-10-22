#pragma once
#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_VEML7700.h>
#include <PubSubClient.h>

// ================= VEML7700 Ambient Light Sensor =================
// ใช้ช่อง Ambient Light Sensor บน PCB (I2C): SDA -> GPIO21, SCL -> GPIO22
// ใช้บัสเดียวกับ SHT40 ได้ (ที่อยู่ VEML7700 = 0x10, SHT40 = 0x44 ไม่ชนกัน)
static const int LIGHT_SDA_PIN = 21;
static const int LIGHT_SCL_PIN = 22;
static const unsigned long LIGHT_REPORT_MS = 5000;   // อ่านและส่งทุก 5 วินาที
static const unsigned long LIGHT_RETRY_MS = 10000;   // ถ้าหาเซนเซอร์ไม่เจอ ลองใหม่ทุก 10 วินาที
static const char *LIGHT_TOPIC = "farm/light/data";

// เกณฑ์ระดับความสว่าง (lux) ตั้งจากค่าที่วัดจริงใน log
// 0 มืด <10 | 1 สลัว 10-100 | 2 ปกติ 100-1,000 | 3 สว่าง 1,000-10,000 | 4 สว่างมาก >=10,000
static const float LIGHT_THRESHOLDS[] = {10.0f, 100.0f, 1000.0f, 10000.0f};
static const int LIGHT_THRESHOLD_N = sizeof(LIGHT_THRESHOLDS) / sizeof(LIGHT_THRESHOLDS[0]);
static const char *LIGHT_LEVEL_NAMES[] = {"มืด", "สลัว", "ปกติ", "สว่าง", "สว่างมาก"};

static int lightLevel(float lux) {
  int level = 0;
  for (int i = 0; i < LIGHT_THRESHOLD_N; i++) {
    if (lux >= LIGHT_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

static Adafruit_VEML7700 veml;
static bool lightReady = false;

static bool lightTryInit() {
  if (veml.begin()) {
    lightReady = true;
    Serial.println("VEML7700 พร้อมใช้งาน");
  } else {
    lightReady = false;
    Serial.println("ไม่พบ VEML7700: ตรวจสาย SDA(21)/SCL(22)/VIN/GND และที่อยู่ I2C 0x10");
  }
  return lightReady;
}

static void lightSensorBegin() {
  Wire.begin(LIGHT_SDA_PIN, LIGHT_SCL_PIN);
  lightTryInit();
}

// เรียกใน loop() ทุกรอบ
static void lightSensorLoop(PubSubClient &mqtt) {
  static unsigned long lastRun = 0;
  const unsigned long interval = lightReady ? LIGHT_REPORT_MS : LIGHT_RETRY_MS;
  if (millis() - lastRun < interval) return;
  lastRun = millis();

  if (!lightReady) {
    lightTryInit();
    return;
  }

  // VEML_LUX_AUTO ปรับ gain/เวลารับแสงอัตโนมัติ และแก้ค่าที่ความสว่างสูง
  float lux = veml.readLux(VEML_LUX_AUTO);
  int level = lightLevel(lux);
  Serial.printf("แสง: %.1f lux (%s)\n", lux, LIGHT_LEVEL_NAMES[level]);

  if (mqtt.connected()) {
    char buf[64];
    snprintf(buf, sizeof(buf), "{\"lux\":%.1f,\"level\":%d}", lux, level);
    mqtt.publish(LIGHT_TOPIC, buf);
  }
}
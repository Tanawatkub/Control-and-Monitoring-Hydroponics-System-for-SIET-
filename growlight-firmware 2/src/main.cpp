#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <esp_wifi.h>
#include <esp_arduino_version.h>
#include "secrets.h"
#include "water_level.h"

#if ESP_ARDUINO_VERSION_MAJOR >= 3
#include <esp_eap_client.h>
#else
#include <esp_wpa2.h>
#endif

// ================= ค่าคงที่ของระบบ =================
const char *MQTT_TOPIC = "farm/growlight/command";
const int MQTT_PORT = 8883; // MQTT over TLS

const int PWM_PIN = 5;
const int PWM_CHANNEL = 0;
const int PWM_FREQ = 2000;
const int PWM_RESOLUTION = 15;

const unsigned long WIFI_TIMEOUT_MS = 60000;
const unsigned long ENTERPRISE_TRY_MS = 35000;
const unsigned long WIFI_RETRY_INTERVAL_MS = 500;
const unsigned long MQTT_RETRY_INTERVAL_MS = 2000; // [แก้ข้อ 5]

// ================= Calibration แบบวัดตรง =================
const int DUTY_AT_MIN = 1720;
const int DUTY_AT_MAX = 1853;
const int PWM_DUTY_MAX = (1 << PWM_RESOLUTION) - 1;

WiFiClientSecure espClient;
PubSubClient client(espClient);

unsigned long lastMqttAttempt = 0;     // [แก้ข้อ 5]
bool mqttPortProbed = false;           // [แก้ข้อ 6]

// ================= แสดงชนิดการเข้ารหัส Wi-Fi =================
const char *authModeName(wifi_auth_mode_t authMode) {
  switch (authMode) {
    case WIFI_AUTH_OPEN:            return "OPEN";
    case WIFI_AUTH_WEP:             return "WEP";
    case WIFI_AUTH_WPA_PSK:         return "WPA-PSK";
    case WIFI_AUTH_WPA2_PSK:        return "WPA2-PSK";
    case WIFI_AUTH_WPA_WPA2_PSK:    return "WPA/WPA2-PSK";
    case WIFI_AUTH_WPA2_ENTERPRISE: return "WPA2-Enterprise";
    default:                        return "ชนิดอื่น/ไม่ทราบ";
  }
}

// ================= สแกน Wi-Fi ก่อนเริ่มเชื่อมต่อ =================
void scanNetworks() {
  Serial.println("กำลังสแกนเครือข่าย Wi-Fi...");
  int networkCount = WiFi.scanNetworks();

  if (networkCount < 0) {
    Serial.println("สแกนเครือข่ายไม่สำเร็จ");
    return;
  }
  if (networkCount == 0) {
    Serial.println("ไม่พบเครือข่าย Wi-Fi");
    return;
  }

  for (int index = 0; index < networkCount; index++) {
    Serial.print("SSID: ");
    Serial.print(WiFi.SSID(index));
    Serial.print(" | RSSI: ");
    Serial.print(WiFi.RSSI(index));
    Serial.print(" dBm | Channel: ");
    Serial.print(WiFi.channel(index));
    Serial.print(" | Encryption: ");
    Serial.println(authModeName(WiFi.encryptionType(index)));
  }

  WiFi.scanDelete();
}

// ================= ข้อความอธิบาย Wi-Fi disconnect reason =================
const char *wifiDisconnectReasonText(uint8_t reason) {
  switch (reason) {
    case 2:
      return "หมดเวลายืนยันตัวตน (AUTH_EXPIRE): ตรวจ username/password หรือการตั้งค่า Enterprise";
    case 15:
      return "จับมือ WPA ไม่สำเร็จ (4-way handshake timeout): ตรวจรหัสผ่านและการตั้งค่าเครือข่าย";
    case 201:
      return "ไม่พบ Access Point (NO_AP_FOUND): ตรวจ SSID, ระยะสัญญาณ และย่านความถี่";
    case 202:
      return "ยืนยันตัวตนไม่ผ่าน (AUTH_FAIL): ตรวจ EAP identity, username, password และ phase 2";
    case 204:
      return "เชื่อมต่อ Access Point ไม่สำเร็จ (ASSOC_FAIL): ตรวจนโยบายหรือการตั้งค่าของเครือข่าย";
    default:
      return "รหัสสาเหตุอื่น ให้ตรวจสอบการตั้งค่าเครือข่ายและระบบยืนยันตัวตน";
  }
}

// ================= ตั้งค่า WPA2-Enterprise =================
bool configureEnterpriseWifi() {
#if EAP_USE_TTLS
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_err_t phase2Result =
      esp_eap_client_set_ttls_phase2_method(EAP_TTLS_PHASE2_METHOD);
#else
  esp_err_t phase2Result =
      esp_wifi_sta_wpa2_ent_set_ttls_phase2_method(EAP_TTLS_PHASE2_METHOD);
#endif
  if (phase2Result != ESP_OK) {
    Serial.printf("ตั้งค่า EAP-TTLS phase 2 ไม่สำเร็จ: %d\n", phase2Result);
    return false;
  }
#endif

#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_err_t result = esp_eap_client_set_identity(
      reinterpret_cast<const unsigned char *>(EAP_IDENTITY), strlen(EAP_IDENTITY));
  if (result != ESP_OK) {
    Serial.printf("ตั้งค่า EAP identity ไม่สำเร็จ: %d\n", result);
    return false;
  }

  result = esp_eap_client_set_username(
      reinterpret_cast<const unsigned char *>(EAP_USERNAME), strlen(EAP_USERNAME));
  if (result != ESP_OK) {
    Serial.printf("ตั้งค่า EAP username ไม่สำเร็จ: %d\n", result);
    return false;
  }

  result = esp_eap_client_set_password(
      reinterpret_cast<const unsigned char *>(EAP_PASSWORD), strlen(EAP_PASSWORD));
  if (result != ESP_OK) {
    Serial.printf("ตั้งค่า EAP password ไม่สำเร็จ: %d\n", result);
    return false;
  }

  if (strlen(EAP_CA_CERT) > 0) {
    result = esp_eap_client_set_ca_cert(
        reinterpret_cast<const unsigned char *>(EAP_CA_CERT), strlen(EAP_CA_CERT) + 1);
    if (result != ESP_OK) {
      Serial.printf("ตั้งค่า EAP CA certificate ไม่สำเร็จ: %d\n", result);
      return false;
    }
  }

  result = esp_wifi_sta_enterprise_enable();
#else
  esp_err_t result = esp_wifi_sta_wpa2_ent_set_identity(
      reinterpret_cast<uint8_t *>(const_cast<char *>(EAP_IDENTITY)), strlen(EAP_IDENTITY));
  if (result != ESP_OK) {
    Serial.printf("ตั้งค่า EAP identity ไม่สำเร็จ: %d\n", result);
    return false;
  }

  result = esp_wifi_sta_wpa2_ent_set_username(
      reinterpret_cast<uint8_t *>(const_cast<char *>(EAP_USERNAME)), strlen(EAP_USERNAME));
  if (result != ESP_OK) {
    Serial.printf("ตั้งค่า EAP username ไม่สำเร็จ: %d\n", result);
    return false;
  }

  result = esp_wifi_sta_wpa2_ent_set_password(
      reinterpret_cast<uint8_t *>(const_cast<char *>(EAP_PASSWORD)), strlen(EAP_PASSWORD));
  if (result != ESP_OK) {
    Serial.printf("ตั้งค่า EAP password ไม่สำเร็จ: %d\n", result);
    return false;
  }

  if (strlen(EAP_CA_CERT) > 0) {
    result = esp_wifi_sta_wpa2_ent_set_ca_cert(
        reinterpret_cast<uint8_t *>(const_cast<char *>(EAP_CA_CERT)), strlen(EAP_CA_CERT) + 1);
    if (result != ESP_OK) {
      Serial.printf("ตั้งค่า EAP CA certificate ไม่สำเร็จ: %d\n", result);
      return false;
    }
  }

  result = esp_wifi_sta_wpa2_ent_enable();
#endif

  if (result != ESP_OK) {
    Serial.printf("เปิดใช้งาน WPA2-Enterprise ไม่สำเร็จ: %d\n", result);
    return false;
  }
  return true;
}

// [แก้ข้อ 3] ปิดโหมด Enterprise ก่อนสลับไป WPA2-PSK
void disableEnterpriseWifi() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_wifi_sta_enterprise_disable();
#else
  esp_wifi_sta_wpa2_ent_disable();
#endif
}

// ================= Wi-Fi Enterprise พร้อม fallback =================
void setupWifi() {
  WiFi.mode(WIFI_STA);
  scanNetworks();

  const unsigned long startedAt = millis();
  const bool hasFallback = strlen(WIFI_FALLBACK_SSID) > 0;

  Serial.print("กำลังตั้งค่า WPA2-Enterprise สำหรับ SSID: ");
  Serial.println(WIFI_ENTERPRISE_SSID);

  if (!configureEnterpriseWifi()) {
    Serial.println("ตั้งค่า Enterprise ไม่สำเร็จ");
  } else {
    WiFi.begin(WIFI_ENTERPRISE_SSID);

    // ถ้าไม่มี fallback ให้ Enterprise ใช้เวลาเต็ม 60 วินาที
    const unsigned long enterpriseDeadline =
        startedAt + (hasFallback ? ENTERPRISE_TRY_MS : WIFI_TIMEOUT_MS);

    while (WiFi.status() != WL_CONNECTED && millis() < enterpriseDeadline) {
      Serial.print(".");
      delay(WIFI_RETRY_INTERVAL_MS);
    }
  }

  if (WiFi.status() != WL_CONNECTED && hasFallback &&
      millis() - startedAt < WIFI_TIMEOUT_MS) {
    Serial.println();
    Serial.println("เชื่อมต่อ Enterprise ไม่สำเร็จ กำลังลอง Wi-Fi สำรองแบบ WPA2-PSK");

    WiFi.disconnect();
    delay(300);
    disableEnterpriseWifi();   // [แก้ข้อ 3] ต้องปิดก่อน ไม่งั้น PSK ต่อไม่ติด
    WiFi.begin(WIFI_FALLBACK_SSID, WIFI_FALLBACK_PASSWORD);

    while (WiFi.status() != WL_CONNECTED &&
           millis() - startedAt < WIFI_TIMEOUT_MS) {
      Serial.print(".");
      delay(WIFI_RETRY_INTERVAL_MS);
    }
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println();
    Serial.println("เชื่อมต่อ Wi-Fi ไม่สำเร็จภายใน 60 วินาที กำลัง restart ESP32");
    delay(500);
    ESP.restart();
    return;
  }

  WiFi.setSleep(false);

  Serial.println();
  Serial.print("Wi-Fi เชื่อมต่อแล้ว, IP: ");
  Serial.println(WiFi.localIP());
}

int remapToNarrowRange(int value0to255) {
  value0to255 = constrain(value0to255, 0, 255);

  if (value0to255 == 0) {
    return 0;
  }

  float dutyFloat =
      DUTY_AT_MIN + ((value0to255 - 1) / 254.0) * (DUTY_AT_MAX - DUTY_AT_MIN);
  int duty = (int)round(dutyFloat);
  return constrain(duty, 0, PWM_DUTY_MAX);
}

void handlePwmCommand(byte *payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.print("แปลง JSON ไม่สำเร็จ: ");
    Serial.println(error.c_str());
    return;
  }

  if (!doc.containsKey("value")) {
    Serial.println("payload ไม่มี field 'value'");
    return;
  }

  int value = doc["value"];
  value = constrain(value, 0, 255);

  int duty = remapToNarrowRange(value);
  ledcWrite(PWM_CHANNEL, duty);

  Serial.print("ค่าที่ได้รับ = ");
  Serial.print(value);
  Serial.print(" (0-255) -> duty จริงที่ส่งออก = ");
  Serial.print(duty);
  Serial.print(" / ");
  Serial.println(PWM_DUTY_MAX);
}

void mqttCallback(char *topic, byte *payload, unsigned int length) {
  Serial.print("ข้อความเข้าจาก topic: ");
  Serial.println(topic);

  if (strcmp(topic, MQTT_TOPIC) == 0) {
    handlePwmCommand(payload, length);
  }
}

// ================= คำอธิบาย PubSubClient state =================
const char *mqttStateText(int state) {
  switch (state) {
    case 0:  return "เชื่อมต่อแล้ว";
    case -4: return "หมดเวลารอการเชื่อมต่อ";
    case -3: return "การเชื่อมต่อหลุด";
    case -2: return "เชื่อมต่อ broker ไม่สำเร็จ: ตรวจ DNS, พอร์ต 8883, TLS หรือเครือข่าย";
    case -1: return "ยังไม่ได้เชื่อมต่อ";
    case 1:  return "โปรโตคอล MQTT ไม่ถูกต้อง";
    case 2:  return "broker ปฏิเสธ client ID";
    case 3:  return "broker ไม่พร้อมให้บริการ";
    case 4:  return "username/password ของ MQTT ไม่ถูกต้อง";
    case 5:  return "ไม่มีสิทธิ์เชื่อมต่อหรือไม่มีสิทธิ์ใช้งาน topic";
    default: return "สถานะ MQTT อื่น";
  }
}

void checkMqttPort() {
  WiFiClient probe;
  Serial.printf("กำลังตรวจ TCP ไปยัง %s:%d...\n", MQTT_BROKER, MQTT_PORT);

  if (probe.connect(MQTT_BROKER, MQTT_PORT)) {
    Serial.println("เชื่อมต่อ TCP พอร์ต 8883 ได้");
    probe.stop();
  } else {
    Serial.println("เชื่อมต่อ TCP พอร์ต 8883 ไม่ได้: อาจถูก firewall หรือเครือข่ายบล็อก");
  }
}

// [แก้ข้อ 5] ลองครั้งเดียวต่อรอบ ไม่ค้างใน while เพื่อให้ loop() ยังเช็ก WiFi ได้
void reconnectMqtt() {
  if (lastMqttAttempt != 0 && millis() - lastMqttAttempt < MQTT_RETRY_INTERVAL_MS) {
    return;
  }
  lastMqttAttempt = millis();

  Serial.print("กำลังเชื่อมต่อ MQTT broker...");

  String clientId = "esp32-growlight-" + String(random(0xffff), HEX);

  if (client.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
    Serial.println(" เชื่อมต่อสำเร็จ");
    mqttPortProbed = false;
    bool subOk = client.subscribe(MQTT_TOPIC);
    Serial.print("subscribe topic: ");
    Serial.print(MQTT_TOPIC);
    Serial.println(subOk ? " -> สำเร็จ" : " -> ล้มเหลว! เช็ค permission ของ credential ใน HiveMQ Cloud");
  } else {
    int state = client.state();
    Serial.print(" ล้มเหลว state=");
    Serial.print(state);
    Serial.print(" (");
    Serial.print(mqttStateText(state));
    Serial.println(")");

    // [แก้ข้อ 6] probe พอร์ตแค่ครั้งแรกที่ล้มเหลว
    if (!mqttPortProbed) {
      mqttPortProbed = true;
      checkMqttPort();
    }
    Serial.println("จะลองเชื่อมต่อ MQTT ใหม่ใน 2 วินาที");
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
    if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
#else
    if (event == SYSTEM_EVENT_STA_DISCONNECTED) {
#endif
      uint8_t reason = info.wifi_sta_disconnected.reason;
      Serial.printf("Wi-Fi disconnect reason code: %u\n", reason);
      Serial.println(wifiDisconnectReasonText(reason));
    }
  });

  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(PWM_PIN, PWM_CHANNEL);

  ledcWrite(PWM_CHANNEL, 0);

  waterLevelBegin();

  setupWifi();

  // [แก้ข้อ 7] ถ้าใส่ MQTT_CA_CERT ใน secrets.h จะตรวจ certificate จริง
  // ถ้าปล่อยว่างจะใช้ setInsecure() เหมือนเดิม (ใช้ทดสอบเท่านั้น)
  if (strlen(MQTT_CA_CERT) > 0) {
    espClient.setCACert(MQTT_CA_CERT);
  } else {
    espClient.setInsecure();
  }

  client.setServer(MQTT_BROKER, MQTT_PORT);
  client.setCallback(mqttCallback);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWifi();
  }

  if (!client.connected()) {
    reconnectMqtt();
  }

  client.loop();

  waterLevelLoop(client);
  
}
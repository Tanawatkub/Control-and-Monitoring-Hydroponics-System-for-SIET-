#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ================= แก้ค่าตรงนี้ให้ตรงกับของคุณ =================
const char *WIFI_SSID = "BYTONOAK";
const char *WIFI_PASSWORD = "1234567888";

// จาก HiveMQ Cloud console: Cluster URL (ไม่ต้องมี wss:// หรือพอร์ตต่อท้าย)
// เช่น "xxxxxxxx.s1.eu.hivemq.cloud"
const char *MQTT_BROKER = "222cfef4a957446ea68f7659b4f66857.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883; // MQTT over TLS

// จาก HiveMQ Cloud > Access Management > Add Credentials
const char *MQTT_USERNAME = "G05Hydroponics";
const char *MQTT_PASSWORD = "P@ssw0rd";
// ================================================================

const char *MQTT_TOPIC = "farm/growlight/command";

const int PWM_PIN = 5;         // GPIO5 ตามแผนเดิม
const int PWM_CHANNEL = 0;     // ledc channel 0-15
const int PWM_FREQ = 2000;     // Hz (ตรงกับ spec ของโมดูล PWM-to-Voltage)
const int PWM_RESOLUTION = 15; // bit -> ค่า 0-32767

// ================= Calibration แบบวัดตรง (ใช้ duty จริงที่วัด/คำนวณได้) =================
// DUTY_AT_MIN = 1720 -> ประมาณ 0.68V (extrapolate จากจุดที่วัดจริง duty=1750->0.703V)
// DUTY_AT_MAX = 1853 -> วัดจริงได้ 0.768V
// หมายเหตุ: 1720 ยังไม่ได้วัดตรงจุดจริง เป็นค่าประมาณจากเส้นตรง ถ้าลองใช้แล้วไฟกระพริบ/ดับ
// ให้ขยับตัวเลขนี้ขึ้นทีละ 5-10 จนกว่าจะติดนิ่งที่แรงดันต่ำสุดที่ต้องการ
const int DUTY_AT_MIN = 1720; // duty ที่ value=1 (ไฟติดอ่อนสุด ~0.68V)
const int DUTY_AT_MAX = 1853; // duty ที่ value=255 (สว่างสุด ~0.768V ห้ามเกิน)
const int PWM_DUTY_MAX = (1 << PWM_RESOLUTION) - 1; // 32767 ที่ 15-bit

// value=0     -> duty=0 (ไฟดับสนิท)
// value=1-255 -> duty ถูกบีบไล่เรียงเส้นตรงระหว่าง DUTY_AT_MIN ถึง DUTY_AT_MAX เท่านั้น
int remapToNarrowRange(int value0to255) {
  value0to255 = constrain(value0to255, 0, 255);

  if (value0to255 == 0) {
    return 0; // ดับสนิท
  }

  // value 1-255 -> ไล่เส้นตรงจาก DUTY_AT_MIN ถึง DUTY_AT_MAX
  float dutyFloat = DUTY_AT_MIN + ((value0to255 - 1) / 254.0) * (DUTY_AT_MAX - DUTY_AT_MIN);
  int duty = (int)round(dutyFloat);
  return constrain(duty, 0, PWM_DUTY_MAX);
}

WiFiClientSecure espClient;
PubSubClient client(espClient);

void setupWifi() {
  Serial.print("กำลังเชื่อมต่อ WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retry = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    retry++;
    if (retry > 60) { // ถ้าเกิน ~30 วินาทียังไม่ติด ลองใหม่ทั้งหมด
      Serial.println();
      Serial.println("ต่อ WiFi ไม่สำเร็จ กำลังลองใหม่...");
      WiFi.disconnect(true);
      delay(1000);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      retry = 0;
    }
  }

  WiFi.setSleep(false); // ปิด power-save mode กัน WiFi หลุด-เชื่อมใหม่วนบ่อยๆ

  Serial.println();
  Serial.print("WiFi เชื่อมต่อแล้ว, IP: ");
  Serial.println(WiFi.localIP());
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

void reconnectMqtt() {
  while (!client.connected()) {
    Serial.print("กำลังเชื่อมต่อ MQTT broker...");

    String clientId = "esp32-growlight-" + String(random(0xffff), HEX);

    if (client.connect(clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println(" เชื่อมต่อสำเร็จ");
      bool subOk = client.subscribe(MQTT_TOPIC);
      Serial.print("subscribe topic: ");
      Serial.print(MQTT_TOPIC);
      Serial.println(subOk ? " -> สำเร็จ" : " -> ล้มเหลว! เช็ค Permission ของ credential ใน HiveMQ Cloud");
    } else {
      Serial.print(" ล้มเหลว rc=");
      Serial.print(client.state());
      Serial.println(" ลองใหม่ใน 2 วินาที");
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);

  ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(PWM_PIN, PWM_CHANNEL);
  ledcWrite(PWM_CHANNEL, 0);

  setupWifi();

  // ข้าม verify ใบรับรอง เพื่อความง่ายตอนทดสอบ
  // (งานจริงควรใช้ setCACert() กับ root CA ของ HiveMQ แทน)
  espClient.setInsecure();

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
}
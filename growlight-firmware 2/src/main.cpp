#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ================= แก้ค่าตรงนี้ให้ตรงกับของคุณ =================
const char *WIFI_SSID = "Iphone 15";
const char *WIFI_PASSWORD = "11111111";

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
const int PWM_FREQ = 2000;     // Hz
const int PWM_RESOLUTION = 8;  // bit -> ค่า 0-255

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

  WiFi.setSleep(false); // ปิด power-save mode กัน WiFi หลุด-เชื่อมใหม่วนบ่อยๆ (มักเกิดกับ hotspot มือถือ)

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

  ledcWrite(PWM_CHANNEL, value);

  Serial.print("ตั้งค่า PWM = ");
  Serial.println(value);
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
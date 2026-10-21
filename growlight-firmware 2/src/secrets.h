#ifndef SECRETS_H
#define SECRETS_H

// WPA2-Enterprise ของมหาวิทยาลัย
#define WIFI_ENTERPRISE_SSID "YOUR_UNIVERSITY_WIFI_SSID"
#define EAP_IDENTITY "67030091"
#define EAP_USERNAME "67030091"
#define EAP_PASSWORD "Keng0954749692"

// ตั้งเป็น 0 สำหรับ PEAP/MSCHAPv2 หรือ 1 สำหรับ EAP-TTLS
#define EAP_USE_TTLS 0
#define EAP_TTLS_PHASE2_METHOD ESP_EAP_TTLS_PHASE2_MSCHAPV2

// CA ของ HiveMQ (ISRG Root X1) ปล่อยว่างไว้ = ไม่ตรวจ certificate (ใช้ทดสอบเท่านั้น)
#define MQTT_CA_CERT ""


// วาง CA certificate จริงไว้ตรงนี้เมื่อเครือข่ายกำหนดให้ตรวจสอบ certificate
// ปล่อยว่างได้เฉพาะเมื่อผู้ดูแลเครือข่ายยืนยันว่าไม่ต้องใช้
#define EAP_CA_CERT ""

// Wi-Fi สำรองแบบ WPA2-PSK เช่น hotspot มือถือ
// เว้น SSID ว่างเพื่อปิด fallback
#define WIFI_FALLBACK_SSID ""
#define WIFI_FALLBACK_PASSWORD ""

// HiveMQ Cloud
// ใส่เฉพาะ hostname ไม่ต้องใส่ wss:// หรือพอร์ต
#define MQTT_BROKER "YOUR-CLUSTER-ID.s1.eu.hivemq.cloud"
#define MQTT_USERNAME "YOUR_MQTT_USERNAME"
#define MQTT_PASSWORD "YOUR_MQTT_PASSWORD"

#endif
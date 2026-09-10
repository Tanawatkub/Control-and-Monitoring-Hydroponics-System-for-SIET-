# Grow Light Firmware (ESP32 WROOM)

Firmware สำหรับ ESP32 WROOM ที่ subscribe MQTT topic `farm/growlight/command`
แล้วเอาค่า `value` (0–255) ไปสั่ง PWM ออกที่ GPIO5

ทำงานคู่กับโปรเจกต์เว็บ `grow-light-web` — ทั้งสองฝั่งต้องต่อ broker ตัวเดียวกัน

## ก่อนใช้งาน แก้ค่าตรงนี้ใน `src/main.cpp`

```cpp
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char *MQTT_BROKER = "YOUR-CLUSTER-ID.s1.eu.hivemq.cloud"; // จาก HiveMQ Cloud console
const char *MQTT_USERNAME = "YOUR_MQTT_USERNAME"; // จาก Access Management
const char *MQTT_PASSWORD = "YOUR_MQTT_PASSWORD";
```

> สำคัญ: `MQTT_BROKER` ใส่แค่ host ธรรมดา (ไม่มี `wss://` และไม่มีพอร์ตต่อท้าย)
> ต่อผ่าน **port 8883 (MQTT over TLS)** ซึ่งคนละพอร์ตกับที่หน้าเว็บใช้ (8884, WebSocket over TLS)
> ทั้งสองพอร์ตอยู่ใน cluster เดียวกัน ใช้ username/password ชุดเดียวกันได้

## Build / Flash / Monitor (PlatformIO ใน VS Code)

1. ติดตั้ง PlatformIO IDE extension ใน VS Code (Extensions > ค้นหา "PlatformIO IDE")
2. เปิดโฟลเดอร์ `growlight-firmware` นี้ใน VS Code (แยกหน้าต่าง หรือเพิ่มเข้า workspace เดิมก็ได้)
3. รอ PlatformIO โหลด toolchain + library ครั้งแรก (ใช้เวลาสักพัก มีแถบสถานะด้านล่าง)
4. เสียบ ESP32 WROOM เข้าเครื่องด้วยสาย USB
5. กดไอคอน PlatformIO (รูปมด) ที่แถบซ้าย หรือใช้ปุ่มที่แถบล่างสุดของ VS Code:
   - ✓ (Build) — คอมไพล์เช็คโค้ด
   - → (Upload) — แฟลชลงบอร์ด
   - 🔌 (Serial Monitor) — เปิดดู log จากบอร์ด
6. ถ้า Upload หา port ไม่เจอ ให้เช็คว่าลง driver USB-to-serial แล้ว (ชิปยอดนิยมคือ CP2102 หรือ CH340)

หลัง Upload สำเร็จ เปิด Serial Monitor จะเห็น log แบบนี้ถ้าทุกอย่างถูกต้อง:

```
กำลังเชื่อมต่อ WiFi: your-ssid
WiFi เชื่อมต่อแล้ว, IP: 192.168.1.xx
กำลังเชื่อมต่อ MQTT broker... เชื่อมต่อสำเร็จ
subscribe topic: farm/growlight/command
```

พอกดส่ง PWM จากหน้าเว็บ ควรเห็นบรรทัด `ตั้งค่า PWM = ...` ขึ้นทันที และไฟที่ต่อ GPIO5 ควรสว่าง/หรี่ตามค่า

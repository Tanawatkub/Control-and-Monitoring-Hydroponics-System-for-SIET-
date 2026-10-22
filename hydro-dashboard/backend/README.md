# Hydroponics Bridge Service
ESP32 ⇄ HiveMQ Cloud (MQTT) ⇄ **Bridge** ⇄ Supabase

ทำหน้าที่: รับ telemetry จาก ESP32 → ตรวจค่า → เขียน `sensor_logs` / ติดตามออนไลน์-ออฟไลน์ (`devices`) /
รับคำสั่งจากหน้าเว็บ (`control_commands`) → ส่งให้ ESP32 → รับ ack → อัปเดต `actuators`
> Edge Functions ถือการเชื่อมต่อ MQTT ค้างไว้ไม่ได้ จึงต้องรัน Bridge เป็นโปรเซสแยก (VPS / Railway / Render / Fly.io / เครื่องที่เปิดตลอด)

## เซนเซอร์ (1 ไฟล์ต่อ 1 ตัว ใน `src/sensors/`)
ph, ec, temperature, humidity, waterLevel, light, current  (ตอนนี้เฟิร์มแวร์ส่งแค่ ph / ระดับน้ำ / แสง; ไม่มีความชื้นดิน เพราะเป็นระบบไฮโดรโปนิกส์)
เพิ่มเซนเซอร์ใหม่: (1) เพิ่มคอลัมน์ใน `sensor_logs` (2) คัดลอกไฟล์ใน `src/sensors/` แล้วแก้ (3) ใส่ใน `SENSORS` ที่ `index.js`

## Topic / Payload — รูปแบบหลัก: ตามเอกสารของทีมเฟิร์มแวร์ (`farm/*`)
| Topic | ทิศทาง | Payload | ลง DB |
|---|---|---|---|
| `farm/waterlevel/data` | ESP32→Backend | `{"mv":1204,"percent":75.4}` | `water_level_cm` = percent × ความยาวแผ่น (`WATER_PROBE_CM`, 4 ซม.) ÷ 100 |
| `farm/light/data` | ESP32→Backend | `{"lux":62.7,"level":1}` | `light_lux` |
| `farm/ph/data` | ESP32→Backend | `{"ph":6.86,"v":2.646,"valid":1}` | `ph` (ข้ามเมื่อ `valid` ≠ 1) |
| `farm/growlight/command` | Backend→ESP32 | `{"action":"set_pwm","value":0-255,"percentage":50.2,"timestamp":"..."}` | คำสั่งจากหน้า Control ของ actuator `grow_light_dimmer` |

- ไม่มี device ID / timestamp ในข้อความ: Backend ใช้บอร์ดเดียวใน `devices` (หรือตั้ง `FARM_DEVICE`) และประทับเวลาตอนรับ
- แต่ละเซนเซอร์ส่งคนละ topic ทุก 5 วินาที Backend รวมค่าล่าสุดเป็นแถวเดียวแล้วบันทึกไม่ถี่กว่า `MIN_INSERT_INTERVAL_SEC`
- ไม่มีข้อความ status/ack: ถือว่าออนไลน์เมื่อยังมีข้อมูลเข้า, ออฟไลน์เมื่อเงียบเกิน `OFFLINE_AFTER_SEC`; คำสั่งไฟปลูกถือว่าสำเร็จเมื่อ broker รับ (QoS 1) แล้วอัปเดตสถานะ actuator ตามที่สั่ง (firmware ไม่ตอบกลับ)
- บัญชี HiveMQ ของ Backend: ควรมีสิทธิ์ **Subscribe + Publish เฉพาะ `farm/growlight/command`** (ถ้าให้ Subscribe อย่างเดียว สั่งไฟจากหน้า Control ไม่ได้)
- ปิดโหมดนี้ได้ด้วย `FARM_ENABLED=false`

### รูปแบบสำรอง `hydro/{key}/...` (รองรับหลายบอร์ด + ack + Last Will — ใช้ถ้าทีมตกลงเปลี่ยน)
`hydro/{key}/telemetry` (JSON หลายค่า), `/status` (`online`/`offline`), `/cmd`, `/ack` — `{key}` = MAC ไม่มี `:` ตัวพิมพ์เล็ก หรือ `devices.id`

## ตั้งค่า HiveMQ Cloud
1. สมัคร HiveMQ Cloud → สร้าง cluster (Serverless ฟรี) → จดค่า **Cluster URL**
2. Access Management → สร้างผู้ใช้ 1 บัญชีสำหรับ Bridge (สิทธิ์ publish+subscribe) และอีกบัญชีสำหรับ ESP32
3. พอร์ต MQTT over TLS = **8883**

## รัน
```bash
cp .env.example .env     # แล้วกรอกค่าเองในไฟล์นี้เท่านั้น (ห้ามส่งในแชท/ห้าม commit)
npm install
npm test                 # เทสต์ 40 ข้อ (ใช้ broker จำลอง ไม่ต้องมีบัญชีจริง)
npm start                # ไม่ต้อง build (JavaScript รันตรง)
npm run simulate         # อุปกรณ์จำลอง ใช้ลองระบบโดยไม่มี ESP32
```
`SUPABASE_SERVICE_ROLE_KEY` ใช้ฝั่งเซิร์ฟเวอร์นี้เท่านั้น ห้ามใส่ใน Frontend

## ยังไม่เคยทดสอบกับของจริง
HiveMQ Cloud จริง, Supabase จริง (insert/Realtime), ESP32 จริง — เทสต์ที่รันใช้ broker และ store จำลองในเครื่อง

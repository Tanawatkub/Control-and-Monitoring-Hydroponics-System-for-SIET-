# Grow Light Test

หน้าเว็บ React สำหรับทดสอบส่งค่า PWM ไปยัง MQTT Broker ก่อนต่อ ESP32/Supabase จริง

## วิธีติดตั้งและรัน

```bash
npm install
npm run dev
```

แล้วเปิด http://localhost:5173

## ตั้งค่า Broker

ในหน้าเว็บมีช่องกรอก **MQTT Broker (WebSocket URL)** ให้ใส่ URL ของ Broker ที่รองรับ WebSocket
เช่น `wss://your-cluster-id.s1.eu.hivemq.cloud:8884/mqtt` แล้วกด **เชื่อมต่อ**

> Broker ต้องเปิด WebSocket listener ไว้ (เช่น Mosquitto ต้องเปิด listener พอร์ต 8081/8083 แบบ websockets)
> หากยังไม่มี broker ของตัวเอง ใช้ตัวสาธารณะทดสอบได้ชั่วคราว เช่น `wss://test.mosquitto.org:8081/mqtt`
> (broker สาธารณะไม่เหมาะกับใช้งานจริง เพราะทุกคนเห็น topic เดียวกันได้)

ค่า default ตั้งไว้ใน `src/App.jsx` ที่ `DEFAULT_BROKER_URL` แก้ให้ตรงกับของคุณได้เลย

ถ้า broker ต้องการ login (เช่น HiveMQ Cloud) กรอก **username / password** ในช่องด้านล่าง Broker URL ก่อนกด เชื่อมต่อ — ได้ค่านี้มาจากตอนสร้าง Credentials ใน HiveMQ Cloud console

## Topic ที่ใช้

ส่งไปที่ topic: `farm/growlight/command`

Payload ตัวอย่าง:

```json
{
  "action": "set_pwm",
  "value": 128,
  "percentage": 50.2,
  "timestamp": "2026-09-10T12:00:00.000Z"
}
```

## ลำดับการทดสอบที่แนะนำ

1. `npm run dev` แล้วเปิดหน้าเว็บ ดูว่าขึ้นหรือไม่
2. กรอก Broker URL แล้วกด "เชื่อมต่อ" ดูสถานะเป็น "เชื่อมต่อแล้ว"
3. กดปุ่ม preset (0/25/50/75/100%) แล้วกด "ส่งค่า PWM" ดู payload ที่แสดงในหน้าเว็บ
4. เปิด MQTT client อีกตัว (เช่น MQTT Explorer หรือ `mosquitto_sub`) แล้ว subscribe topic `farm/growlight/command` เพื่อยืนยันว่าข้อความส่งถึงจริง
5. ขั้นต่อไปค่อยเขียน ESP32 firmware ให้ subscribe topic เดียวกัน รับ `value` (0–255) แล้วออก PWM ที่ GPIO5

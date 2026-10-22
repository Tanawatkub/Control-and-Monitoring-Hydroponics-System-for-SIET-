# Hydroponics Dashboard (SIET)

หน้าเว็บ Dashboard สำหรับระบบควบคุมและเฝ้าระวังไฮโดรโปนิกส์ เชื่อมกับฐานข้อมูล Supabase ที่ตรวจรับแล้ว (smoke test 15/15)
เทคโนโลยี: Vite + React 18 + JavaScript (JSX) + supabase-js + recharts + react-router

## เริ่มใช้งาน
```bash
npm install
cp .env.example .env     # แล้วใส่ URL และ anon key ของโปรเจกต์ (Supabase -> Project Settings -> API)
npm run dev              # เปิด http://localhost:5173
npm run build            # สร้างไฟล์สำหรับ deploy ไว้ที่ dist/
```
**ห้ามใส่ service_role key ในหน้าเว็บ** ใช้เฉพาะ anon (publishable) key ความปลอดภัยทั้งหมดอยู่ที่ RLS ในฐานข้อมูล

## โครงสร้างโค้ด
```
src/
  lib/
    supabase.js        สร้าง client จาก .env
    (ไม่มี types แล้ว: ชื่อตาราง/คอลัมน์อ้างอิงตาม DB ตรง ๆ)
    sensors.js         ตารางนิยามเซนเซอร์ 8 ตัว (คอลัมน์ ป้าย หน่วย คอลัมน์ min/max ใน thresholds) ตรงกับ RULES ใน Edge Function check-thresholds
    format.js          ฟอร์แมตตัวเลข/เวลา (ภาษาไทย)
  auth/
    AuthProvider.jsx   session + โปรไฟล์ (role) isAdmin / isStaff
    Guards.jsx         RequireAuth, RequireRole
  hooks/
    useQuery.js        ดึงข้อมูล + ตัวฟัง Realtime
    data.js            useDevices, useLatestReading, useHistory, useThreshold, useAlerts, useActuators, useCommands, useProfiles, useAuditLogs
    DeviceContext.jsx  อุปกรณ์ที่เลือก (ใช้ร่วมทุกหน้า)
  components/          Layout, SensorCard, SensorChart
  pages/               Login, Dashboard, Alerts, Thresholds, Control, Users, Audit, Account
```

## หน้า ↔ ตาราง/สิทธิ์ในฐานข้อมูล
| หน้า | ใช้ตาราง/ฟังก์ชัน | ใครใช้ได้ | Realtime |
|---|---|---|---|
| Dashboard `/` | devices, sensor_logs, thresholds | ทุก role | sensor_logs (INSERT), devices |
| แจ้งเตือน `/alerts` | alert_logs (ปิดเคส = UPDATE) | ดู: ทุก role, ปิดเคส: admin/operator | alert_logs |
| เกณฑ์ `/thresholds` | thresholds (UPDATE) | admin/operator | - |
| ควบคุม `/control` | actuators, control_commands (INSERT) | admin/operator | actuators, control_commands |
| ผู้ใช้ `/users` | profiles (SELECT ทั้งหมด, UPDATE role) | admin | - |
| ประวัติแก้ไข `/audit` | audit_logs | admin | - |
| บัญชี `/account` | profiles (ของตัวเอง), rpc `create_line_link_code` | ทุก role | - |

หน้าเว็บซ่อนเมนูตาม role แต่ **ตัวบังคับจริงคือ RLS ใน DB** ถ้าเรียกตรงก็ถูกปฏิเสธที่ฐานข้อมูลอยู่ดี

## สัญญากับ Bridge Service (สำคัญ ต้องตกลงกับคนทำ Bridge)
หน้าควบคุมเขียนแถว `control_commands` (status = pending) แล้ว Bridge ต้องอ่านไปส่ง MQTT และอัปเดต `status` เป็น acked/failed พร้อม `acked_at` และอัปเดตตาราง `actuators`
| command | value | ความหมาย |
|---|---|---|
| `on` / `off` | ไม่ใช้ | เปิด/ปิดรีเลย์ |
| `set_duty` | 0-100 | ตั้ง PWM (%) |
| `set_mode` | 0 หรือ 1 | **0 = auto, 1 = manual** (ข้อตกลงของหน้าเว็บ ต้องให้ Bridge ตีความตรงกัน) |

## เพิ่มเซนเซอร์ใหม่
1. เพิ่มคอลัมน์ใน `sensor_logs` (และคอลัมน์เกณฑ์ใน `thresholds` ถ้าต้องการแจ้งเตือน)
2. เพิ่ม 1 บรรทัดใน `src/lib/sensors.js` การ์ด กราฟ และสถานะจะตามมาเอง
3. ถ้าต้องการแจ้งเตือน เพิ่มบรรทัดใน RULES ของ Edge Function `check-thresholds` ด้วย

## การ Deploy
`npm run build` แล้วนำโฟลเดอร์ `dist/` ไปไว้ที่ Vercel / Netlify / Cloudflare Pages (ตั้ง Environment Variables เป็นค่าเดียวกับ .env) ต้องตั้ง rewrite ทุกเส้นทางไปที่ `index.html` (SPA)

## ข้อจำกัดที่ควรรู้
- ยังไม่ได้ทดสอบกับ Supabase จริง (ทดสอบด้วย backend จำลอง 3 role) การทดสอบ Realtime และ RLS จริงต้องลองหลังใส่ .env
- รหัสผู้ใช้ใหม่สร้างที่ Supabase → Authentication → Add user (ยังไม่มีหน้าสมัครสมาชิก ตั้งใจให้ admin คุมการสร้างบัญชี)
- กราฟดึงสูงสุด 2,000 จุดต่อช่วงเวลา และรีเฟรชทุก 30 วินาที
- recharts v2 (ยังใช้งานได้ แต่มีเวอร์ชัน 3 ออกแล้ว)

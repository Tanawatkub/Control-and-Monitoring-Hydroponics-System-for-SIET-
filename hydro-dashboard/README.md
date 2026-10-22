# ระบบควบคุมและติดตามสวนผักไฮโดรโปนิกส์ (SIET)

```
ESP32 ──MQTT──> HiveMQ Cloud <──MQTT── backend (Bridge) ──> Supabase <── frontend (Dashboard)
```
| โฟลเดอร์ | คืออะไร | ที่รัน |
|---|---|---|
| `frontend/` | Dashboard (React) อ่าน/เขียน Supabase ด้วย anon key + RLS | เครื่องผู้ใช้ / โฮสต์เว็บ |
| `backend/`  | Bridge: HiveMQ ⇄ Supabase (ใช้ service_role) | เซิร์ฟเวอร์ที่เปิดตลอด |

ทั้งสองส่วนแยก dependency กัน (มี package.json ของตัวเอง) ห้ามเอาไฟล์ข้ามกัน

## เริ่มใช้
```bash
npm run install:all
cp frontend/.env.example frontend/.env   # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
cp backend/.env.example  backend/.env    # HiveMQ + SUPABASE_SERVICE_ROLE_KEY
npm run check            # เทสต์ + build ทั้งสองส่วน
npm run dev              # เปิดหน้าเว็บ
npm run dev:frontend     # คำสั่งเดิมสำหรับเปิดหน้าเว็บ
npm run simulate         # อุปกรณ์จำลอง (อีกหน้าต่างหนึ่ง) ดูข้อมูลไหลเข้า Dashboard
```
**ความปลอดภัย:** `SUPABASE_SERVICE_ROLE_KEY` และรหัส HiveMQ อยู่ใน `backend/.env` เท่านั้น ห้ามใส่ใน frontend ห้ามส่งในแชท ห้าม commit
สัญญาระหว่างสองฝั่ง (ชนิดคำสั่ง, สถานะ, ชื่อคอลัมน์) มีเทสต์คุมใน `backend/test/frontend-contract.test.js`
รายละเอียดแต่ละส่วนดู `frontend/README.md` และ `backend/README.md`

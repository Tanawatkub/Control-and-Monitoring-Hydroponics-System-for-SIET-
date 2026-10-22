// ทะเบียนเซนเซอร์ทั้งหมด เพิ่มเซนเซอร์ใหม่ 3 ขั้น:
//   1) เพิ่มคอลัมน์ใน sensor_logs (SQL migration)
//   2) สร้างไฟล์ใหม่ในโฟลเดอร์นี้ (คัดลอกจากไฟล์ที่ใกล้เคียง แล้วแก้)
//   3) เพิ่มเข้า SENSORS ด้านล่าง
import type { SensorModule } from './types.js'
import { ph } from './ph.js'
import { ec } from './ec.js'
import { temperature } from './temperature.js'
import { humidity } from './humidity.js'
import { waterLevel } from './waterLevel.js'
import { light } from './light.js'
import { current } from './current.js'

export const SENSORS: SensorModule[] = [ph, ec, temperature, humidity, waterLevel, light, current]
export type { SensorModule }

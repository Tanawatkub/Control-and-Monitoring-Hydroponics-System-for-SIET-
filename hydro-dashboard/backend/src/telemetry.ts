// แปลงข้อมูลจากเซนเซอร์ (JSON) เป็นแถวของ sensor_logs โดยใช้โมดูลของเซนเซอร์แต่ละตัวใน ./sensors
import { SENSORS } from './sensors/index.js'

export interface ParsedTelemetry {
  row: Record<string, number>       // เฉพาะคอลัมน์ที่ถูกต้อง
  recordedAt?: string               // ISO ถ้าอุปกรณ์ส่งเวลามาและสมเหตุสมผล
  rejected: string[]                // ฟิลด์ที่ถูกทิ้ง พร้อมเหตุผล (ไว้ log)
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function parseTs(v: unknown, nowMs: number): string | undefined {
  let ms: number | null = null
  if (typeof v === 'number' && Number.isFinite(v)) ms = v < 1e11 ? v * 1000 : v // วินาที หรือ มิลลิวินาที
  else if (typeof v === 'string') { const t = Date.parse(v); if (!Number.isNaN(t)) ms = t }
  if (ms === null) return undefined
  // ESP32 ที่ไม่มี RTC มักส่งเวลาผิด: ยอมรับเฉพาะช่วง 24 ชม.ที่แล้ว ถึง 5 นาทีข้างหน้า
  if (ms < nowMs - 24 * 3600_000 || ms > nowMs + 5 * 60_000) return undefined
  return new Date(ms).toISOString()
}

export function parseTelemetry(raw: unknown, nowMs = Date.now()): ParsedTelemetry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const row: Record<string, number> = {}
  const rejected: string[] = []
  for (const s of SENSORS) {
    const alias = s.aliases.find((a) => a in obj)
    if (!alias) continue
    const n = toNumber(obj[alias])
    if (n === null) { rejected.push(`${s.label} (${alias}): ไม่ใช่ตัวเลข`); continue }
    if (n < s.min || n > s.max) { rejected.push(`${s.label} (${alias})=${n}: นอกช่วง ${s.min}..${s.max}`); continue }
    const v = s.transform ? s.transform(n) : n
    if (v === null) { rejected.push(`${s.label} (${alias}): ถูกทิ้งโดย transform`); continue }
    row[s.col] = v
  }
  if (Object.keys(row).length === 0) return null
  return { row, recordedAt: parseTs(obj.ts, nowMs), rejected }
}

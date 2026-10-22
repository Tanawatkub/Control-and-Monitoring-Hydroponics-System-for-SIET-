import type { SensorLog, Threshold } from './types'

// ตารางนิยามเซนเซอร์ (ตรงกับ RULES ใน Edge Function check-thresholds)
// เพิ่มเซนเซอร์ใหม่ = เพิ่ม 1 บรรทัดที่นี่ การ์ด กราฟ และสถานะจะตามมาเอง
export interface SensorDef {
  key: string
  col: keyof SensorLog
  label: string
  unit: string
  decimals: number
  min?: keyof Threshold
  max?: keyof Threshold
}

export const SENSORS: SensorDef[] = [
  { key: 'ph', col: 'ph', label: 'pH', unit: '', decimals: 2, min: 'ph_min', max: 'ph_max' },
  { key: 'ec', col: 'ec', label: 'EC', unit: 'mS/cm', decimals: 2, min: 'ec_min', max: 'ec_max' },
  { key: 'temperature', col: 'temperature', label: 'อุณหภูมิ', unit: '°C', decimals: 1, min: 'temp_min', max: 'temp_max' },
  { key: 'humidity', col: 'humidity', label: 'ความชื้นอากาศ', unit: '%', decimals: 1, min: 'humidity_min', max: 'humidity_max' },
  { key: 'water_level', col: 'water_level_cm', label: 'ระดับน้ำ', unit: 'cm', decimals: 1, min: 'water_level_min_cm' },
  { key: 'light', col: 'light_lux', label: 'ความเข้มแสง', unit: 'lux', decimals: 0, min: 'light_min', max: 'light_max' },
  { key: 'soil_moisture', col: 'soil_moisture_pct', label: 'ความชื้นดิน', unit: '%', decimals: 1, min: 'soil_moisture_min', max: 'soil_moisture_max' },
  { key: 'current', col: 'current_a', label: 'กระแสไฟ', unit: 'A', decimals: 2, max: 'current_max' },
]

export type SensorState = 'nodata' | 'ok' | 'low' | 'high'

export function sensorState(value: number | null | undefined, th: Threshold | null, def: SensorDef): SensorState {
  if (value === null || value === undefined) return 'nodata'
  if (!th) return 'ok'
  const lo = def.min ? th[def.min] : null
  const hi = def.max ? th[def.max] : null
  if (typeof hi === 'number' && value > hi) return 'high'
  if (typeof lo === 'number' && value < lo) return 'low'
  return 'ok'
}

export const PARAMETER_LABEL: Record<string, string> = {
  ph: 'pH', ec: 'EC', temperature: 'อุณหภูมิ', humidity: 'ความชื้นอากาศ', water_level: 'ระดับน้ำ',
  device_offline: 'อุปกรณ์ออฟไลน์', light: 'ความเข้มแสง', soil_moisture: 'ความชื้นดิน', current: 'กระแสไฟ',
}

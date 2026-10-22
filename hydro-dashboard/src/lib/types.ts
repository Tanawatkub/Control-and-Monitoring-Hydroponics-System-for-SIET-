// ชนิดข้อมูลตรงกับตารางจริงใน Supabase (อ้างอิงจาก schema ที่ตรวจรับแล้ว)
// ภายหลังสร้างอัตโนมัติได้ด้วย: npx supabase gen types typescript --project-id <ref>

export type Role = 'admin' | 'operator' | 'user'

export interface Profile {
  id: string
  email: string
  display_name: string | null
  role: Role
  created_at: string
  line_user_id: string | null
}

export interface Device {
  id: string
  name: string
  mac_address: string | null
  location: string | null
  is_online: boolean | null
  last_seen: string | null
  created_at: string
  plant_profile_id: string | null
  user_id: string | null
}

export interface SensorLog {
  id: string
  device_id: string | null
  ph: number | null
  ec: number | null
  temperature: number | null
  humidity: number | null
  water_level_cm: number | null
  recorded_at: string
  light_lux: number | null
  soil_moisture_pct: number | null
  current_a: number | null
}

export interface Threshold {
  id: string
  device_id: string | null
  ph_min: number | null
  ph_max: number | null
  ec_min: number | null
  ec_max: number | null
  temp_min: number | null
  temp_max: number | null
  humidity_min: number | null
  humidity_max: number | null
  water_level_min_cm: number | null
  light_min: number | null
  light_max: number | null
  soil_moisture_min: number | null
  soil_moisture_max: number | null
  current_max: number | null
  hysteresis: number | null
  operating_mode: 'auto' | 'manual'
  updated_at: string
}

export type AlertParameter =
  | 'ph' | 'ec' | 'temperature' | 'humidity' | 'water_level'
  | 'device_offline' | 'light' | 'soil_moisture' | 'current'

export interface AlertLog {
  id: string
  device_id: string | null
  parameter: AlertParameter
  severity: 'warning' | 'critical'
  value: number | null
  threshold_value: number | null
  message: string
  is_resolved: boolean | null
  resolved_at: string | null
  created_at: string
}

export interface Actuator {
  id: string
  device_id: string
  name: string
  kind: 'relay' | 'pwm'
  channel: number | null
  is_on: boolean
  duty_pct: number
  mode: 'auto' | 'manual'
  updated_at: string
}

export type CommandType = 'on' | 'off' | 'set_duty' | 'set_mode'

export interface ControlCommand {
  id: string
  device_id: string
  actuator_id: string | null
  requested_by: string | null
  command: CommandType
  value: number | null
  status: 'pending' | 'acked' | 'failed' | 'expired'
  created_at: string
  acked_at: string | null
}

export interface AuditLog {
  id: string
  table_name: string
  record_id: string | null
  action: string
  changed_by: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_at: string
}

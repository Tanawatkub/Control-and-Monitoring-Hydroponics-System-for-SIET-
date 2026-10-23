import type { SensorDef, SensorState } from '../lib/sensors'
import { fmtNum } from '../lib/format'
import { Activity, Droplets, Gauge, Sun, Thermometer, Waves, Wind, Zap, type LucideIcon } from 'lucide-react'

const TEXT: Record<SensorState, string> = { nodata: 'ไม่มีข้อมูล', ok: 'ปกติ', low: 'ต่ำกว่าเกณฑ์', high: 'สูงกว่าเกณฑ์' }
const SENSOR_ICONS: Record<string, LucideIcon> = {
  ph: Droplets,
  ec: Activity,
  temperature: Thermometer,
  humidity: Wind,
  water_level: Waves,
  light: Sun,
  soil_moisture: Droplets,
  current: Zap,
}

export function SensorCard({ def, value, state, active, onClick }: {
  def: SensorDef; value: number | null; state: SensorState; active: boolean; onClick: () => void
}) {
  const Icon = SENSOR_ICONS[def.key] ?? Gauge
  return (
    <button className={`sensor ${state} ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="sensor-heading">
        <span className="muted small">{def.label}</span>
        <span className="sensor-icon"><Icon size={17} /></span>
      </span>
      <span className="big">{fmtNum(value, def.decimals)}<small>{value === null || !def.unit ? '' : ` ${def.unit}`}</small></span>
      <span className={`badge ${state}`}>{TEXT[state]}</span>
    </button>
  )
}

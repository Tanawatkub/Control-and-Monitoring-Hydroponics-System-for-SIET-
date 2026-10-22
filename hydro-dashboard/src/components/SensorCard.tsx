import type { SensorDef, SensorState } from '../lib/sensors'
import { fmtNum } from '../lib/format'

const TEXT: Record<SensorState, string> = { nodata: 'ไม่มีข้อมูล', ok: 'ปกติ', low: 'ต่ำกว่าเกณฑ์', high: 'สูงกว่าเกณฑ์' }

export function SensorCard({ def, value, state, active, onClick }: {
  def: SensorDef; value: number | null; state: SensorState; active: boolean; onClick: () => void
}) {
  return (
    <button className={`sensor ${state} ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="muted small">{def.label}</span>
      <span className="big">{fmtNum(value, def.decimals)}<small> {value === null ? '' : def.unit}</small></span>
      <span className={`badge ${state}`}>{TEXT[state]}</span>
    </button>
  )
}

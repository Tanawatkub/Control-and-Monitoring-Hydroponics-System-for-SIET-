import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SensorLog, Threshold } from '../lib/types'
import type { SensorDef } from '../lib/sensors'

export function SensorChart({ rows, def, th }: { rows: SensorLog[]; def: SensorDef; th: Threshold | null }) {
  const data = rows
    .filter((r) => r[def.col] !== null)
    .map((r) => ({ t: new Date(r.recorded_at).getTime(), v: Number(r[def.col]) }))
  if (data.length === 0) return <p className="muted">ยังไม่มีข้อมูลในช่วงเวลานี้</p>
  const lo = def.min && th ? th[def.min] : null
  const hi = def.max && th ? th[def.max] : null
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time"
          tickFormatter={(t: number) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} />
        <YAxis domain={['auto', 'auto']} width={48} />
        <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleString('th-TH')}
          formatter={(v) => [`${v} ${def.unit}`, def.label]} />
        {typeof hi === 'number' && <ReferenceLine y={hi} stroke="#d9534f" strokeDasharray="4 4" label="สูงสุด" />}
        {typeof lo === 'number' && <ReferenceLine y={lo} stroke="#f0ad4e" strokeDasharray="4 4" label="ต่ำสุด" />}
        <Line type="monotone" dataKey="v" stroke="#2e9e5b" dot={false} strokeWidth={2} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

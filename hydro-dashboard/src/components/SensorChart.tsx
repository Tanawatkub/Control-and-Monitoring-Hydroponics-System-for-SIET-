import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="sensor-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time"
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          tickFormatter={(t: number) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} />
        <YAxis domain={['auto', 'auto']} width={48} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
        <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleString('th-TH')}
          formatter={(v) => [`${v} ${def.unit}`, def.label]} />
        {typeof hi === 'number' && <ReferenceLine y={hi} stroke="var(--danger)" strokeDasharray="4 4" label="สูงสุด" />}
        {typeof lo === 'number' && <ReferenceLine y={lo} stroke="var(--warning)" strokeDasharray="4 4" label="ต่ำสุด" />}
        <Area type="monotone" dataKey="v" stroke="var(--primary)" fill="url(#sensor-area-gradient)" dot={false} strokeWidth={2.5} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

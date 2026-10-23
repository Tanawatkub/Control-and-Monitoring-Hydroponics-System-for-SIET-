import { useState } from 'react'
import { SensorCard } from '../components/SensorCard'
import { SensorChart } from '../components/SensorChart'
import { useSelectedDevice } from '../hooks/DeviceContext'
import { useHistory, useLatestReading, useThreshold } from '../hooks/data'
import { SENSORS, sensorState } from '../lib/sensors'
import { fmtTime } from '../lib/format'
import type { Threshold } from '../lib/types'

export function Dashboard() {
  const { selectedId, loading: devLoading, error: devError } = useSelectedDevice()
  const { latest } = useLatestReading(selectedId)
  const { data: th } = useThreshold(selectedId)
  const [sensorKey, setSensorKey] = useState('ph')
  const [hours, setHours] = useState(6)
  const { rows, loading } = useHistory(selectedId, hours)
  const def = SENSORS.find((s) => s.key === sensorKey) ?? SENSORS[0]

  if (devLoading) return <p className="muted">กำลังโหลด...</p>
  if (devError) return <p className="error">โหลดอุปกรณ์ไม่สำเร็จ: {devError}</p>

  return (
    <>
      <p className="muted small">ข้อมูลล่าสุด: {fmtTime(latest?.recorded_at)} (อัปเดตสดเมื่อมีข้อมูลใหม่)</p>
      <section className="grid">
        {SENSORS.map((s) => {
          const v = latest ? (latest[s.col] as number | null) : null
          return (
            <SensorCard key={s.key} def={s} value={v} state={sensorState(v, th as Threshold | null, s)}
              active={s.key === sensorKey} onClick={() => setSensorKey(s.key)} />
          )
        })}
      </section>
      <section className="card">
        <div className="row between">
          <h3>กราฟ {def.label}</h3>
          <div className="range-pills" aria-label="ช่วงเวลา">
            {[{ value: 1, label: '1 ชม.' }, { value: 6, label: '6 ชม.' }, { value: 24, label: '24 ชม.' }, { value: 168, label: '7 วัน' }].map(({ value, label }) => (
              <button key={value} type="button" className={hours === value ? 'selected' : ''} onClick={() => setHours(value)}>{label}</button>
            ))}
          </div>
        </div>
        {loading ? <p className="muted">กำลังโหลดกราฟ...</p> : <SensorChart rows={rows} def={def} th={th as Threshold | null} />}
      </section>
    </>
  )
}

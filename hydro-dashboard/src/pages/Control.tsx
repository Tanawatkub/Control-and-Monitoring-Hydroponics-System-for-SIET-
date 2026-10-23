import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useSelectedDevice } from '../hooks/DeviceContext'
import { useActuators, useCommands } from '../hooks/data'
import { fmtTime } from '../lib/format'
import type { Actuator, CommandType } from '../lib/types'

// สัญญากับ Bridge Service: set_mode ส่ง value 0 = auto, 1 = manual
const STATUS_TH = { pending: 'รอดำเนินการ', acked: 'สำเร็จ', failed: 'ล้มเหลว', expired: 'หมดเวลา' } as const

export function Control() {
  const { session } = useAuth()
  const { selectedId } = useSelectedDevice()
  const { data: acts, loading, error } = useActuators(selectedId)
  const { data: cmds } = useCommands(selectedId)
  const [duty, setDuty] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)

  const send = async (a: Actuator, command: CommandType, value: number | null = null) => {
    if (!session) return
    // RLS "staff insert commands": ต้องเป็น admin/operator และ requested_by ต้องเป็นตัวเอง
    const { error } = await supabase.from('control_commands').insert({
      device_id: a.device_id, actuator_id: a.id, requested_by: session.user.id, command, value,
    })
    setMsg(error ? `ส่งคำสั่งไม่สำเร็จ: ${error.message}` : null)
  }

  const nameOf = (id: string | null) => (acts ?? []).find((a) => a.id === id)?.name ?? '-'

  return (
    <>
      <p className="muted small">ระบบส่งคำสั่งลงฐานข้อมูล แล้ว Bridge Service ส่งต่อไปยัง ESP32 ผ่าน MQTT สถานะจะเปลี่ยนเมื่ออุปกรณ์ตอบรับ</p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="error">{msg}</p>}
      {loading ? <p className="muted">กำลังโหลด...</p> : (
        <section className="grid wide">
          {(acts ?? []).map((a) => (
            <div className="card" key={a.id}>
              <div className="row between">
                <strong>{a.name}</strong>
                <span className={`badge ${a.mode === 'auto' ? 'ok' : 'low'}`}>{a.mode === 'auto' ? 'auto' : 'manual'}</span>
              </div>
              <p className="muted small">{a.kind === 'relay' ? `รีเลย์${a.channel ? ` ช่อง ${a.channel}` : ''}` : 'PWM'} · อัปเดต {fmtTime(a.updated_at)}</p>
              {a.kind === 'relay' ? (
                <div className="row">
                  <span className={`badge ${a.is_on ? 'ok' : 'off'}`}>{a.is_on ? 'เปิดอยู่' : 'ปิดอยู่'}</span>
                  <button onClick={() => void send(a, a.is_on ? 'off' : 'on')}>{a.is_on ? 'สั่งปิด' : 'สั่งเปิด'}</button>
                </div>
              ) : (
                <div className="row">
                  <span className="badge ok">{a.duty_pct}%</span>
                  <input className="short" inputMode="numeric" placeholder="0-100" value={duty[a.id] ?? ''}
                    onChange={(e) => setDuty({ ...duty, [a.id]: e.target.value })} />
                  <button onClick={() => {
                    const n = Number(duty[a.id])
                    if (Number.isNaN(n) || n < 0 || n > 100) { setMsg('Duty ต้องเป็นตัวเลข 0-100'); return }
                    void send(a, 'set_duty', n)
                  }}>ตั้งค่า</button>
                </div>
              )}
              <div className="row top">
                <button className="ghost" onClick={() => void send(a, 'set_mode', a.mode === 'auto' ? 1 : 0)}>
                  สลับเป็น {a.mode === 'auto' ? 'manual' : 'auto'}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      <h3>คำสั่งล่าสุด</h3>
      <div className="card table-wrap"><table>
        <thead><tr><th>เวลา</th><th>อุปกรณ์</th><th>คำสั่ง</th><th>ค่า</th><th>สถานะ</th></tr></thead>
        <tbody>{(cmds ?? []).map((c) => (
          <tr key={c.id}><td>{fmtTime(c.created_at)}</td><td>{nameOf(c.actuator_id)}</td><td>{c.command}</td><td>{c.value ?? '-'}</td>
            <td><span className={`badge ${c.status === 'acked' ? 'ok' : c.status === 'pending' ? 'low' : 'high'}`}>{STATUS_TH[c.status]}</span></td></tr>
        ))}</tbody>
      </table></div>
    </>
  )
}

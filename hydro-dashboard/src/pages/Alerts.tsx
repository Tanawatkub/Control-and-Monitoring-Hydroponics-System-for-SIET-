import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useAlerts } from '../hooks/data'
import { PARAMETER_LABEL } from '../lib/sensors'
import { fmtTime } from '../lib/format'

export function Alerts() {
  const { isStaff } = useAuth()
  const [onlyOpen, setOnlyOpen] = useState(true)
  const { data, loading, error, reload } = useAlerts(onlyOpen)
  const [msg, setMsg] = useState<string | null>(null)

  const resolve = async (id: string) => {
    // RLS "staff update alerts": เฉพาะ admin/operator
    const { error } = await supabase.from('alert_logs').update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('id', id)
    setMsg(error ? `ปิดเคสไม่สำเร็จ: ${error.message}` : null)
    void reload()
  }

  return (
    <>
      <div className="row between">
        <label className="row"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> เฉพาะที่ยังไม่ปิด</label>
      </div>
      {error && <p className="error">{error}</p>}
      {msg && <p className="error">{msg}</p>}
      {loading ? <p className="muted">กำลังโหลด...</p> : (data ?? []).length === 0 ? <p className="muted">ไม่มีการแจ้งเตือน 🎉</p> : (
        <div className="card table-wrap"><table>
          <thead><tr><th>เวลา</th><th>ระดับ</th><th>พารามิเตอร์</th><th>ข้อความ</th><th>สถานะ</th>{isStaff && <th />}</tr></thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id}>
                <td>{fmtTime(a.created_at)}</td>
                <td><span className={`badge ${a.severity === 'critical' ? 'high' : 'low'}`}>{a.severity === 'critical' ? 'วิกฤต' : 'เตือน'}</span></td>
                <td>{PARAMETER_LABEL[a.parameter] ?? a.parameter}</td>
                <td>{a.message}</td>
                <td>{a.is_resolved ? `ปิดแล้ว ${fmtTime(a.resolved_at)}` : 'ยังไม่ปิด'}</td>
                {isStaff && <td>{!a.is_resolved && <button onClick={() => void resolve(a.id)}>ปิดเคส</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </>
  )
}

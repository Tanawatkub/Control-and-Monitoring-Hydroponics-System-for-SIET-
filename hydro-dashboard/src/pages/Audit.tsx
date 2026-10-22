import { useAuditLogs, useProfiles } from '../hooks/data'
import { fmtTime } from '../lib/format'

function diff(o: Record<string, unknown> | null, n: Record<string, unknown> | null): string {
  if (!o || !n) return '-'
  const out: string[] = []
  for (const k of Object.keys(n)) {
    if (k === 'updated_at') continue
    if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) out.push(`${k}: ${o[k] ?? 'null'} → ${n[k] ?? 'null'}`)
  }
  return out.join(', ') || '-'
}

export function Audit() {
  const { data, loading, error } = useAuditLogs()
  const { data: profiles } = useProfiles()
  const who = (id: string | null) => (id ? (profiles ?? []).find((p) => p.id === id)?.email ?? id.slice(0, 8) : 'ระบบ/SQL')
  return (
    <>
      <h2>ประวัติการแก้ไข (Audit)</h2>
      <p className="muted small">บันทึกอัตโนมัติเมื่อมีการเปลี่ยนสิทธิ์ผู้ใช้หรือแก้เกณฑ์ (100 รายการล่าสุด)</p>
      {error && <p className="error">{error}</p>}
      {loading ? <p className="muted">กำลังโหลด...</p> : (
        <div className="card table-wrap"><table>
          <thead><tr><th>เวลา</th><th>ตาราง</th><th>การกระทำ</th><th>โดย</th><th>สิ่งที่เปลี่ยน</th></tr></thead>
          <tbody>{(data ?? []).map((a) => (
            <tr key={a.id}><td>{fmtTime(a.changed_at)}</td><td>{a.table_name}</td><td>{a.action}</td><td>{who(a.changed_by)}</td><td>{diff(a.old_data, a.new_data)}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </>
  )
}

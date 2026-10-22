import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
import { useProfiles } from '../hooks/data';
import { fmtTime } from '../lib/format';
export function Users() {
    const { profile: me } = useAuth();
    const { data, loading, error, reload } = useProfiles();
    const [msg, setMsg] = useState(null);
    const changeRole = async (id, email, role) => {
        if (id === me?.id && role !== 'admin' && !window.confirm('คุณกำลังลดสิทธิ์ของตัวเอง ต่อไปจะจัดการผู้ใช้ไม่ได้ ยืนยัน?'))
            return;
        // RLS "admins see all profiles": เฉพาะ admin แก้ได้ และ trigger audit_profile_role จะบันทึกลง audit_logs
        const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
        setMsg(error ? `เปลี่ยนสิทธิ์ ${email} ไม่สำเร็จ: ${error.message}` : null);
        void reload();
    };
    return (<>
      <h2>จัดการผู้ใช้</h2>
      <p className="muted small">สร้างบัญชีใหม่ที่ Supabase → Authentication → Add user (ระบบสร้างโปรไฟล์ role = user ให้อัตโนมัติ) แล้วมาปรับสิทธิ์ที่หน้านี้</p>
      {error && <p className="error">{error}</p>}
      {msg && <p className="error">{msg}</p>}
      {loading ? <p className="muted">กำลังโหลด...</p> : (<div className="card table-wrap"><table>
          <thead><tr><th>อีเมล</th><th>ชื่อ</th><th>สิทธิ์</th><th>LINE</th><th>สร้างเมื่อ</th></tr></thead>
          <tbody>{(data ?? []).map((p) => (<tr key={p.id}>
              <td>{p.email}{p.id === me?.id && <span className="muted small"> (คุณ)</span>}</td>
              <td>{p.display_name ?? '-'}</td>
              <td>
                <select value={p.role} onChange={(e) => void changeRole(p.id, p.email, e.target.value)}>
                  <option value="admin">admin</option><option value="operator">operator</option><option value="user">user (ดูอย่างเดียว)</option>
                </select>
              </td>
              <td>{p.line_user_id ? 'ผูกแล้ว' : '-'}</td>
              <td>{fmtTime(p.created_at)}</td>
            </tr>))}</tbody>
        </table></div>)}
    </>);
}

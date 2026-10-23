import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

export function Account() {
  const { profile } = useAuth()
  const [code, setCode] = useState<string | null>(null)
  const [expires, setExpires] = useState<number>(0)
  const [left, setLeft] = useState(0)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!expires) return
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((expires - Date.now()) / 1000))
      setLeft(s)
      if (s === 0) { setCode(null); setExpires(0) }
    }, 500)
    return () => clearInterval(t)
  }, [expires])

  const request = async () => {
    setErr(null)
    // ฟังก์ชัน create_line_link_code() ใน DB: ได้รหัส 6 ตัว อายุ 10 นาที
    const { data, error } = await supabase.rpc('create_line_link_code')
    if (error) { setErr(error.message); return }
    setCode(data as string)
    setExpires(Date.now() + 10 * 60 * 1000)
    setLeft(600)
  }

  if (!profile) return null
  return (
    <>
      <div className="card">
        <p><strong>อีเมล:</strong> {profile.email}</p>
        <p><strong>สิทธิ์:</strong> {profile.role}</p>
        <p><strong>LINE:</strong> {profile.line_user_id ? '✅ ผูกแล้ว' : 'ยังไม่ได้ผูก'}</p>
      </div>
      <div className="card">
        <h3>ผูกบัญชีกับ LINE</h3>
        <ol className="small">
          <li>เพิ่มบอทของระบบเป็นเพื่อนใน LINE</li>
          <li>กดปุ่ม "ขอรหัสผูกบัญชี" ด้านล่าง</li>
          <li>พิมพ์ในแชทบอท: <code>ผูก รหัส</code> (ภายใน 10 นาที)</li>
        </ol>
        <button onClick={() => void request()}>ขอรหัสผูกบัญชี</button>
        {err && <p className="error">{err}</p>}
        {code && (
          <p className="code">ผูก {code} <span className="muted small">(หมดอายุใน {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')})</span></p>
        )}
      </div>
    </>
  )
}

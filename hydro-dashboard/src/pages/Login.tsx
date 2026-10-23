import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, Mail, Sprout } from 'lucide-react'
import { supabase, isConfigured } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

export function Login() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (session) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message)
    setBusy(false)
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <div className="login-brand">
          <span className="login-logo"><Sprout size={27} strokeWidth={2} /></span>
          <span className="login-brand-copy">
            <span className="login-eyebrow">SIET · SMART FARM</span>
            <h1>Hydroponics System</h1>
          </span>
        </div>
        <div className="login-intro">
          <h2>ยินดีต้อนรับ</h2>
          <p className="muted">เข้าสู่ระบบเพื่อดูแลและติดตามฟาร์มไฮโดรโปนิกส์ของคุณ</p>
        </div>
        {!isConfigured && (
          <p className="error">ยังไม่ได้ตั้งค่า .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) ดูวิธีใน README</p>
        )}
        <label className="login-field" htmlFor="login-email">
          <span>อีเมล</span>
          <span className="login-input-wrap">
            <Mail size={19} aria-hidden="true" />
            <input id="login-email" type="email" placeholder="name@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </span>
        </label>
        <label className="login-field" htmlFor="login-password">
          <span>รหัสผ่าน</span>
          <span className="login-input-wrap">
            <LockKeyhole size={19} aria-hidden="true" />
            <input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="กรอกรหัสผ่านของคุณ" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button className="password-toggle" type="button" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="login-submit" type="submit" disabled={busy || !isConfigured}>{busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
        <p className="login-footnote"><LockKeyhole size={14} /> เชื่อมต่ออย่างปลอดภัยสำหรับผู้ใช้งาน SIET</p>
      </form>
    </div>
  )
}

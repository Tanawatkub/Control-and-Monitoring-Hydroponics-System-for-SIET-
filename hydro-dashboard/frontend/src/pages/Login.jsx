import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase, isConfigured } from '../lib/supabase';
import { useAuth } from '../auth/AuthProvider';
export function Login() {
    const { session } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    if (session)
        return <Navigate to="/" replace/>;
    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error)
            setError(error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message);
        setBusy(false);
    };
    return (<div className="center">
      <form className="card login" onSubmit={submit}>
        <h1>🌱 Hydroponics SIET</h1>
        <p className="muted">ระบบควบคุมและเฝ้าระวังไฮโดรโปนิกส์</p>
        {!isConfigured && (<p className="error">ยังไม่ได้ตั้งค่า .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) ดูวิธีใน README</p>)}
        <label>อีเมล<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"/></label>
        <label>รหัสผ่าน<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"/></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !isConfigured}>{busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
      </form>
    </div>);
}

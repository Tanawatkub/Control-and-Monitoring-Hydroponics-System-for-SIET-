import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';
export function RequireAuth({ children }) {
    const { session, loading } = useAuth();
    if (loading)
        return <div className="center muted">กำลังโหลด...</div>;
    if (!session)
        return <Navigate to="/login" replace/>;
    return <>{children}</>;
}
// จำกัดหน้าตาม role (ฝั่ง DB ยังมี RLS บังคับซ้ำอีกชั้น ที่นี่แค่ซ่อนหน้าที่ไม่มีสิทธิ์)
export function RequireRole({ roles, children }) {
    const { profile, loading } = useAuth();
    if (loading)
        return <div className="center muted">กำลังโหลด...</div>;
    if (!profile || !roles.includes(profile.role)) {
        return <div className="card"><h2>ไม่มีสิทธิ์เข้าถึงหน้านี้</h2><p className="muted">ต้องเป็น {roles.join(' / ')}</p></div>;
    }
    return <>{children}</>;
}

import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import type { Role } from '../lib/types'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="center muted">กำลังโหลด...</div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

// จำกัดหน้าตาม role (ฝั่ง DB ยังมี RLS บังคับซ้ำอีกชั้น ที่นี่แค่ซ่อนหน้าที่ไม่มีสิทธิ์)
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="center muted">กำลังโหลด...</div>
  if (!profile || !roles.includes(profile.role)) {
    return <div className="card"><h2>ไม่มีสิทธิ์เข้าถึงหน้านี้</h2><p className="muted">ต้องเป็น {roles.join(' / ')}</p></div>
  }
  return <>{children}</>
}

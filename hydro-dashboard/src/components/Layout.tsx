import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useSelectedDevice } from '../hooks/DeviceContext'
import { timeAgo } from '../lib/format'

export function DeviceBar() {
  const { devices, selectedId, selected, select } = useSelectedDevice()
  if (devices.length === 0) return <div className="muted">ยังไม่มีอุปกรณ์ในระบบ</div>
  return (
    <div className="row">
      <select value={selectedId ?? ''} onChange={(e) => select(e.target.value)} aria-label="เลือกอุปกรณ์">
        {devices.map((d) => <option key={d.id} value={d.id}>{d.location ?? d.name}</option>)}
      </select>
      {selected && (
        <span className={`badge ${selected.is_online ? 'ok' : 'off'}`}>
          {selected.is_online ? 'ออนไลน์' : 'ออฟไลน์'} · {timeAgo(selected.last_seen)}
        </span>
      )}
    </div>
  )
}

export function Layout() {
  const { profile, isAdmin, isStaff, signOut } = useAuth()
  return (
    <div className="shell">
      <header className="topbar">
        <strong>🌱 Hydroponics SIET</strong>
        <nav>
          <NavLink to="/" end>ภาพรวม</NavLink>
          <NavLink to="/alerts">แจ้งเตือน</NavLink>
          {isStaff && <NavLink to="/thresholds">เกณฑ์</NavLink>}
          {isStaff && <NavLink to="/control">ควบคุม</NavLink>}
          {isAdmin && <NavLink to="/users">ผู้ใช้</NavLink>}
          {isAdmin && <NavLink to="/audit">ประวัติแก้ไข</NavLink>}
          <NavLink to="/account">บัญชี</NavLink>
        </nav>
        <div className="row">
          <span className="muted small">{profile?.email} ({profile?.role})</span>
          <button className="ghost" onClick={() => void signOut()}>ออกจากระบบ</button>
        </div>
      </header>
      <main className="content"><Outlet /></main>
    </div>
  )
}

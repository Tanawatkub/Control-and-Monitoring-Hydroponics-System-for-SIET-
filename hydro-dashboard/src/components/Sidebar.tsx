import {
  Activity,
  Bell,
  ClipboardList,
  Droplets,
  Gauge,
  LogOut,
  Settings2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

interface SidebarProps {
  open: boolean
  onNavigate: () => void
}

interface SidebarItem {
  label: string
  to: string
  icon: LucideIcon
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const { profile, isAdmin, isStaff, signOut } = useAuth()
  const groups: { label: string; items: SidebarItem[] }[] = [
    {
      label: 'MONITOR',
      items: [
        { label: 'ภาพรวม', to: '/', icon: Activity },
        { label: 'แจ้งเตือน', to: '/alerts', icon: Bell },
      ],
    },
    {
      label: 'CONTROL',
      items: [
        ...(isStaff ? [{ label: 'เกณฑ์', to: '/thresholds', icon: Gauge }] : []),
        ...(isStaff ? [{ label: 'ควบคุม', to: '/control', icon: Settings2 }] : []),
      ],
    },
    {
      label: 'MANAGEMENT',
      items: [
        ...(isAdmin ? [{ label: 'ผู้ใช้', to: '/users', icon: UsersRound }] : []),
        ...(isAdmin ? [{ label: 'ประวัติแก้ไข', to: '/audit', icon: ClipboardList }] : []),
        { label: 'บัญชี', to: '/account', icon: UserRound },
      ],
    },
  ]

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="เมนูหลัก">
      <div className="brand">
        <span className="brand-mark"><Droplets size={21} /></span>
        <span className="brand-copy">
          <strong>SIET Hydroponics</strong>
          <small>ระบบควบคุมและติดตาม</small>
        </span>
      </div>
      <nav className="sidebar-nav">
        {groups.map((group) => group.items.length > 0 && (
          <section className="nav-group" key={group.label}>
            <h2>{group.label}</h2>
            {group.items.map(({ label, to, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={onNavigate}>
                <Icon size={17} strokeWidth={1.9} />
                <span>{label}</span>
              </NavLink>
            ))}
          </section>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-card">
          <span className="avatar">{profile?.email?.[0]?.toUpperCase() ?? 'U'}</span>
          <span className="user-meta">
            <strong title={profile?.email ?? ''}>{profile?.email || 'ผู้ใช้งาน'}</strong>
            <span className="role-badge">{isAdmin ? 'Admin' : isStaff ? 'Operator' : 'User'}</span>
          </span>
        </div>
        <button className="signout-button" onClick={() => void signOut()}>
          <LogOut size={17} />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  )
}

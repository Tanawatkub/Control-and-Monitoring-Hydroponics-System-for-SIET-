import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Outlet, useLocation } from 'react-router-dom'
import { useSelectedDevice } from '../hooks/DeviceContext'
import { timeAgo } from '../lib/format'
import { Sidebar } from './Sidebar'

const PAGE_TITLES: Record<string, string> = {
  '/': 'ภาพรวม',
  '/alerts': 'แจ้งเตือน',
  '/thresholds': 'เกณฑ์',
  '/control': 'ควบคุม',
  '/users': 'ผู้ใช้',
  '/audit': 'ประวัติแก้ไข',
  '/account': 'บัญชี',
}

export function DeviceBar() {
  const { devices, selectedId, selected, select } = useSelectedDevice()
  if (devices.length === 0) return <div className="muted">ยังไม่มีอุปกรณ์ในระบบ</div>
  return (
    <div className="device-bar">
      <select value={selectedId ?? ''} onChange={(e) => select(e.target.value)} aria-label="เลือก Zone">
        {devices.map((d) => <option key={d.id} value={d.id}>{d.location ?? d.name}</option>)}
      </select>
      {selected && (
        <span className={`badge connection ${selected.is_online ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {selected.is_online ? 'ออนไลน์' : 'ออฟไลน์'} · {timeAgo(selected.last_seen)}
        </span>
      )}
    </div>
  )
}

export function Layout() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const title = PAGE_TITLES[location.pathname] ?? 'SIET Hydroponics System'

  return (
    <div className="shell">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div className={`drawer-backdrop ${menuOpen ? 'visible' : ''}`} onClick={() => setMenuOpen(false)} />
      <div className="app-main">
        <header className="page-header">
          <button className="menu-toggle" aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1>{title}</h1>
          <DeviceBar />
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}

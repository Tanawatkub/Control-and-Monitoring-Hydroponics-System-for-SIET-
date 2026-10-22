import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth, RequireRole } from './auth/Guards'
import { DeviceProvider } from './hooks/DeviceContext'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Alerts } from './pages/Alerts'
import { Thresholds } from './pages/Thresholds'
import { Control } from './pages/Control'
import { Users } from './pages/Users'
import { Audit } from './pages/Audit'
import { Account } from './pages/Account'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth><DeviceProvider><Layout /></DeviceProvider></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="thresholds" element={<RequireRole roles={['admin', 'operator']}><Thresholds /></RequireRole>} />
            <Route path="control" element={<RequireRole roles={['admin', 'operator']}><Control /></RequireRole>} />
            <Route path="users" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
            <Route path="audit" element={<RequireRole roles={['admin']}><Audit /></RequireRole>} />
            <Route path="account" element={<Account />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

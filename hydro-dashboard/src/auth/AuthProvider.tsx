import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  isStaff: boolean // admin หรือ operator = ตรงกับฟังก์ชัน is_staff() ใน DB
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) { setProfile(null); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // โหลดโปรไฟล์ (มี role) หลังล็อกอิน RLS อนุญาตให้อ่านโปรไฟล์ของตัวเอง
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle().then(({ data }) => {
      if (cancelled) return
      setProfile((data as Profile | null) ?? null)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [userId])

  const value: AuthState = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isStaff: profile?.role === 'admin' || profile?.role === 'operator',
    signOut: async () => { await supabase.auth.signOut() },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth ต้องอยู่ภายใน AuthProvider')
  return v
}

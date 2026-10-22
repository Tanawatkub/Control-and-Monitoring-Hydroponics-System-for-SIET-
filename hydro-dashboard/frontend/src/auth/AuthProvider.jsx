import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
const Ctx = createContext(null);
export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session);
            if (!data.session)
                setLoading(false);
        });
        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s);
            if (!s) {
                setProfile(null);
                setLoading(false);
            }
        });
        return () => sub.subscription.unsubscribe();
    }, []);
    // โหลดโปรไฟล์ (มี role) หลังล็อกอิน RLS อนุญาตให้อ่านโปรไฟล์ของตัวเอง
    const userId = session?.user.id;
    useEffect(() => {
        if (!userId)
            return;
        let cancelled = false;
        setLoading(true);
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle().then(({ data }) => {
            if (cancelled)
                return;
            setProfile(data ?? null);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [userId]);
    const value = {
        session,
        profile,
        loading,
        isAdmin: profile?.role === 'admin',
        isStaff: profile?.role === 'admin' || profile?.role === 'operator',
        signOut: async () => { await supabase.auth.signOut(); },
    };
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAuth() {
    const v = useContext(Ctx);
    if (!v)
        throw new Error('useAuth ต้องอยู่ภายใน AuthProvider');
    return v;
}

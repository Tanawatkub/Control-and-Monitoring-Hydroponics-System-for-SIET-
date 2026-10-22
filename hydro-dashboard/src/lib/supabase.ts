import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

// ถ้ายังไม่ได้ตั้งค่า .env ให้ใช้ค่าหลอก เพื่อให้หน้าเว็บเปิดขึ้นและแสดงข้อความบอกวิธีตั้งค่า (ไม่ crash)
export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-anon-key')

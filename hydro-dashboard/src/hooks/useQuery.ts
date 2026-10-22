import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// ดึงข้อมูลแบบง่าย: คืน data / loading / error / reload
export function useQuery<T>(fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(async () => {
    const res = await fnRef.current()
    if (res.error) setError(res.error.message)
    else { setError(null); setData(res.data) }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { setLoading(true); void reload() }, [reload])
  return { data, loading, error, reload }
}

// ฟัง Realtime ของตาราง (ตารางต้องอยู่ใน publication supabase_realtime: devices, sensor_logs, alert_logs, actuators, control_commands)
export function useRealtime(
  table: string,
  onChange: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void,
  filter?: string,
  enabled = true,
) {
  const cb = useRef(onChange)
  cb.current = onChange
  useEffect(() => {
    if (!enabled) return
    const name = `rt:${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 8)}`
    const ch = supabase
      .channel(name)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) },
        (p) => cb.current(p as never))
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [table, filter, enabled])
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery, useRealtime } from './useQuery'
import type { Actuator, AlertLog, AuditLog, ControlCommand, Device, Profile, SensorLog, Threshold } from '../lib/types'

export function useDevices() {
  const q = useQuery<Device[]>(() => supabase.from('devices').select('*').order('name') as never, [])
  useRealtime('devices', () => { void q.reload() }) // is_online / last_seen เปลี่ยน
  return q
}

// ค่าล่าสุดของ device: โหลดครั้งแรก 1 แถว แล้วรับ INSERT จาก Realtime ต่อ
export function useLatestReading(deviceId: string | null) {
  const [latest, setLatest] = useState<SensorLog | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLatest(null)
    if (!deviceId) { setLoading(false); return }
    setLoading(true)
    let cancelled = false
    supabase.from('sensor_logs').select('*').eq('device_id', deviceId)
      .order('recorded_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setLatest((data as SensorLog | null) ?? null); setLoading(false) } })
    return () => { cancelled = true }
  }, [deviceId])
  useRealtime('sensor_logs', (p) => {
    if (p.eventType === 'INSERT') setLatest(p.new as unknown as SensorLog)
  }, deviceId ? `device_id=eq.${deviceId}` : undefined, Boolean(deviceId))
  return { latest, loading }
}

// ประวัติย้อนหลังสำหรับกราฟ (รีเฟรชทุก 30 วินาที จำกัด 2000 จุดเพื่อไม่ให้หนัก)
export function useHistory(deviceId: string | null, hours: number) {
  const [rows, setRows] = useState<SensorLog[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!deviceId) { setRows([]); setLoading(false); return }
    let cancelled = false
    const load = async () => {
      const since = new Date(Date.now() - hours * 3600_000).toISOString()
      const { data } = await supabase.from('sensor_logs').select('*').eq('device_id', deviceId)
        .gte('recorded_at', since).order('recorded_at', { ascending: true }).limit(2000)
      if (!cancelled) { setRows((data as SensorLog[] | null) ?? []); setLoading(false) }
    }
    setLoading(true)
    void load()
    const t = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [deviceId, hours])
  return { rows, loading }
}

export function useThreshold(deviceId: string | null) {
  return useQuery<Threshold>(
    () => (deviceId
      ? supabase.from('thresholds').select('*').eq('device_id', deviceId).maybeSingle()
      : Promise.resolve({ data: null, error: null })) as never,
    [deviceId],
  )
}

export function useAlerts(onlyOpen: boolean) {
  const q = useQuery<AlertLog[]>(() => {
    let b = supabase.from('alert_logs').select('*').order('created_at', { ascending: false }).limit(200)
    if (onlyOpen) b = b.eq('is_resolved', false)
    return b as never
  }, [onlyOpen])
  useRealtime('alert_logs', () => { void q.reload() })
  return q
}

export function useActuators(deviceId: string | null) {
  const q = useQuery<Actuator[]>(
    () => (deviceId
      ? supabase.from('actuators').select('*').eq('device_id', deviceId).order('name')
      : Promise.resolve({ data: [], error: null })) as never,
    [deviceId],
  )
  useRealtime('actuators', () => { void q.reload() }, deviceId ? `device_id=eq.${deviceId}` : undefined, Boolean(deviceId))
  return q
}

export function useCommands(deviceId: string | null) {
  const q = useQuery<ControlCommand[]>(
    () => (deviceId
      ? supabase.from('control_commands').select('*').eq('device_id', deviceId).order('created_at', { ascending: false }).limit(15)
      : Promise.resolve({ data: [], error: null })) as never,
    [deviceId],
  )
  useRealtime('control_commands', () => { void q.reload() }, deviceId ? `device_id=eq.${deviceId}` : undefined, Boolean(deviceId))
  return q
}

export function useProfiles() {
  return useQuery<Profile[]>(() => supabase.from('profiles').select('*').order('created_at') as never, [])
}

export function useAuditLogs() {
  return useQuery<AuditLog[]>(() => supabase.from('audit_logs').select('*').order('changed_at', { ascending: false }).limit(100) as never, [])
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface DeviceRow { id: string; mac_address: string | null }
export interface ActuatorRow { id: string; device_id: string; name: string; kind: 'relay' | 'pwm'; channel: number | null }
export interface CommandRow {
  id: string; device_id: string; actuator_id: string | null
  command: 'on' | 'off' | 'set_duty' | 'set_mode'; value: number | null
  status: 'pending' | 'acked' | 'failed' | 'expired'; created_at: string
}
export interface ActuatorPatch { is_on?: boolean; duty_pct?: number; mode?: 'auto' | 'manual' }
export interface CommandPatch { status: 'acked' | 'failed' | 'expired'; acked_at?: string }

// ชั้นติดต่อฐานข้อมูล: Bridge คุยผ่าน interface นี้เท่านั้น (เทสต์ใช้ตัวจำลอง ของจริงใช้ SupabaseStore)
export interface Store {
  loadDevices(): Promise<DeviceRow[]>
  insertSensorLog(deviceId: string, row: Record<string, number>, recordedAt?: string): Promise<void>
  setDeviceStatus(deviceId: string, online: boolean): Promise<void>
  getActuator(id: string): Promise<ActuatorRow | null>
  getCommand(id: string): Promise<CommandRow | null>
  updateCommand(id: string, patch: CommandPatch): Promise<void>
  updateActuator(id: string, patch: ActuatorPatch): Promise<void>
  expirePending(olderThanIso: string): Promise<number>
  listPending(): Promise<CommandRow[]>
  subscribeCommands(cb: (row: CommandRow) => void): Promise<() => void>
}

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

export class SupabaseStore implements Store {
  private sb: SupabaseClient
  constructor(url: string, serviceKey: string) {
    // service_role ข้าม RLS ได้ทั้งหมด ใช้ในเซิร์ฟเวอร์นี้เท่านั้น
    this.sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  }

  async loadDevices(): Promise<DeviceRow[]> {
    return must(await this.sb.from('devices').select('id, mac_address'), 'loadDevices') as DeviceRow[]
  }

  async insertSensorLog(deviceId: string, row: Record<string, number>, recordedAt?: string): Promise<void> {
    const payload: Record<string, unknown> = { device_id: deviceId, ...row }
    if (recordedAt) payload.recorded_at = recordedAt
    must(await this.sb.from('sensor_logs').insert(payload), 'insertSensorLog')
  }

  async setDeviceStatus(deviceId: string, online: boolean): Promise<void> {
    const patch: Record<string, unknown> = { is_online: online }
    if (online) patch.last_seen = new Date().toISOString()
    must(await this.sb.from('devices').update(patch).eq('id', deviceId), 'setDeviceStatus')
  }

  async getActuator(id: string): Promise<ActuatorRow | null> {
    return must(await this.sb.from('actuators').select('id, device_id, name, kind, channel').eq('id', id).maybeSingle(), 'getActuator') as ActuatorRow | null
  }

  async getCommand(id: string): Promise<CommandRow | null> {
    return must(await this.sb.from('control_commands').select('id, device_id, actuator_id, command, value, status, created_at').eq('id', id).maybeSingle(), 'getCommand') as CommandRow | null
  }

  async updateCommand(id: string, patch: CommandPatch): Promise<void> {
    must(await this.sb.from('control_commands').update(patch).eq('id', id), 'updateCommand')
  }

  async updateActuator(id: string, patch: ActuatorPatch): Promise<void> {
    must(await this.sb.from('actuators').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id), 'updateActuator')
  }

  async expirePending(olderThanIso: string): Promise<number> {
    const data = must(await this.sb.from('control_commands').update({ status: 'expired' })
      .eq('status', 'pending').lt('created_at', olderThanIso).select('id'), 'expirePending') as unknown[] | null
    return data?.length ?? 0
  }

  async listPending(): Promise<CommandRow[]> {
    return must(await this.sb.from('control_commands').select('id, device_id, actuator_id, command, value, status, created_at')
      .eq('status', 'pending').order('created_at'), 'listPending') as CommandRow[]
  }

  // รับคำสั่งใหม่แบบ Realtime (ตาราง control_commands อยู่ใน publication supabase_realtime แล้ว)
  async subscribeCommands(cb: (row: CommandRow) => void): Promise<() => void> {
    const ch = this.sb.channel('bridge-commands')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'control_commands' },
        (p) => cb(p.new as CommandRow))
      .subscribe()
    return () => { void this.sb.removeChannel(ch) }
  }
}

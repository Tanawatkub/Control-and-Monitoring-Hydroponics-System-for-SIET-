import { createClient } from '@supabase/supabase-js';
function must(res, what) {
    if (res.error)
        throw new Error(`${what}: ${res.error.message}`);
    return res.data;
}
export class SupabaseStore {
    constructor(url, serviceKey) {
        // service_role ข้าม RLS ได้ทั้งหมด ใช้ในเซิร์ฟเวอร์นี้เท่านั้น
        this.sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    }
    async loadDevices() {
        return must(await this.sb.from('devices').select('id, mac_address'), 'loadDevices');
    }
    async insertSensorLog(deviceId, row, recordedAt) {
        const payload = { device_id: deviceId, ...row };
        if (recordedAt)
            payload.recorded_at = recordedAt;
        must(await this.sb.from('sensor_logs').insert(payload), 'insertSensorLog');
    }
    async setDeviceStatus(deviceId, online) {
        const patch = { is_online: online };
        if (online)
            patch.last_seen = new Date().toISOString();
        must(await this.sb.from('devices').update(patch).eq('id', deviceId), 'setDeviceStatus');
    }
    async getActuator(id) {
        return must(await this.sb.from('actuators').select('id, device_id, name, kind, channel').eq('id', id).maybeSingle(), 'getActuator');
    }
    async getCommand(id) {
        return must(await this.sb.from('control_commands').select('id, device_id, actuator_id, command, value, status, created_at').eq('id', id).maybeSingle(), 'getCommand');
    }
    async updateCommand(id, patch) {
        must(await this.sb.from('control_commands').update(patch).eq('id', id), 'updateCommand');
    }
    async updateActuator(id, patch) {
        must(await this.sb.from('actuators').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id), 'updateActuator');
    }
    async expirePending(olderThanIso) {
        const data = must(await this.sb.from('control_commands').update({ status: 'expired' })
            .eq('status', 'pending').lt('created_at', olderThanIso).select('id'), 'expirePending');
        return data?.length ?? 0;
    }
    async listPending() {
        return must(await this.sb.from('control_commands').select('id, device_id, actuator_id, command, value, status, created_at')
            .eq('status', 'pending').order('created_at'), 'listPending');
    }
    // รับคำสั่งใหม่แบบ Realtime (ตาราง control_commands อยู่ใน publication supabase_realtime แล้ว)
    async subscribeCommands(cb) {
        const ch = this.sb.channel('bridge-commands')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'control_commands' }, (p) => cb(p.new))
            .subscribe();
        return () => { void this.sb.removeChannel(ch); };
    }
}

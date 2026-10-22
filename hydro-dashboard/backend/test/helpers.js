import net from 'node:net';
import { once } from 'node:events';
import Aedes from 'aedes';
import mqtt from 'mqtt';
export async function startBroker() {
    const broker = new Aedes();
    const server = net.createServer(broker.handle);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    return {
        url: `mqtt://127.0.0.1:${port}`,
        close: async () => { await new Promise((r) => broker.close(() => r())); server.close(); },
    };
}
export async function connect(url, opts = {}) {
    const c = mqtt.connect(url, { reconnectPeriod: 0, ...opts });
    await once(c, 'connect');
    return c;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function waitFor(cond, ms = 3000) {
    const t0 = Date.now();
    while (!cond()) {
        if (Date.now() - t0 > ms)
            throw new Error('waitFor หมดเวลา');
        await sleep(10);
    }
}
// Store จำลองในหน่วยความจำ (แทน Supabase)
export class MemoryStore {
    devices = [];
    actuators = [];
    commands = [];
    logs = [];
    statusCalls = [];
    actuatorState = new Map();
    acked = new Map();
    cb = null;
    async loadDevices() { return this.devices; }
    async insertSensorLog(deviceId, row, recordedAt) { this.logs.push({ deviceId, row, recordedAt }); }
    async setDeviceStatus(deviceId, online) { this.statusCalls.push({ deviceId, online }); }
    async getActuator(id) { return this.actuators.find((a) => a.id === id) ?? null; }
    async getCommand(id) { return this.commands.find((c) => c.id === id) ?? null; }
    async updateCommand(id, p) {
        const c = this.commands.find((x) => x.id === id);
        if (c) {
            c.status = p.status;
            if (p.acked_at)
                this.acked.set(id, p.acked_at);
        }
    }
    async updateActuator(id, p) { this.actuatorState.set(id, { ...(this.actuatorState.get(id) ?? {}), ...p }); }
    async expirePending(olderThanIso) {
        let n = 0;
        for (const c of this.commands)
            if (c.status === 'pending' && c.created_at < olderThanIso) {
                c.status = 'expired';
                n++;
            }
        return n;
    }
    async listPending() { return this.commands.filter((c) => c.status === 'pending'); }
    async subscribeCommands(cb) { this.cb = cb; return () => { this.cb = null; }; }
    // จำลองว่าหน้าเว็บ insert คำสั่งใหม่ (Realtime แจ้ง Bridge)
    insertCommand(c) { this.commands.push(c); this.cb?.(c); }
}
export const silent = { info() { }, warn() { }, error() { } };

import { parseTelemetry } from './telemetry.js';
import { farmSubscriptions, growlightMessage, growlightTopic, parseFarmPayload, parseFarmTopic } from './farm.js';
import { cmdTopic, normalizeMac, parseTopic, subscriptions } from './topics.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class Bridge {
    devices = new Map(); // id -> device
    byMac = new Map(); // mac(normalized) -> id
    state = new Map(); // id -> สถานะที่ Bridge จำไว้
    lastInsert = new Map();
    dispatched = new Set();
    warnedUnknown = new Set();
    lastRefresh = 0;
    timers = [];
    unsubCommands = null;
    constructor(mqtt, store, cfg, log = console, now = () => Date.now()) {
        this.mqtt = mqtt;
        this.store = store;
        this.cfg = cfg;
        this.log = log;
        this.now = now;
    }
    async start() {
        await this.refreshDevices();
        this.mqtt.on('message', (topic, payload) => { void this.enqueue(topic, payload); });
        // subscribe ทุกครั้งที่เชื่อมต่อ (รวมตอน reconnect) ; ข้อความ status แบบ retained จะถูกส่งมาให้ทันที
        const topics = [...subscriptions(this.cfg.topicPrefix), ...(this.cfg.farm ? farmSubscriptions(this.cfg.farm.prefix) : [])];
        const sub = () => this.mqtt.subscribe(topics, { qos: 1 }, (err) => {
            if (err)
                this.log.error('subscribe ล้มเหลว', err.message);
            else
                this.log.info('subscribe สำเร็จ', topics.join(', '));
        });
        this.mqtt.on('connect', sub);
        if (this.mqtt.connected)
            sub();
        this.unsubCommands = await this.store.subscribeCommands((row) => { void this.dispatch(row); });
        await this.sweep();
        this.timers.push(setInterval(() => { void this.sweep().catch((e) => this.log.error('sweep', e)); }, 5000));
        this.timers.push(setInterval(() => { void this.refreshDevices().catch((e) => this.log.error('refreshDevices', e)); }, 60_000));
    }
    stop() {
        for (const t of this.timers)
            clearInterval(t);
        this.timers = [];
        this.unsubCommands?.();
    }
    // ---------- อุปกรณ์ ----------
    async refreshDevices() {
        const rows = await this.store.loadDevices();
        this.devices.clear();
        this.byMac.clear();
        for (const d of rows) {
            this.devices.set(d.id, d);
            if (d.mac_address)
                this.byMac.set(normalizeMac(d.mac_address), d.id);
        }
        this.lastRefresh = this.now();
    }
    async resolve(key) {
        const find = () => (UUID.test(key) && this.devices.has(key.toLowerCase()) ? key.toLowerCase() : this.byMac.get(normalizeMac(key)) ?? null);
        let id = find();
        if (!id && this.now() - this.lastRefresh > 10_000) {
            await this.refreshDevices();
            id = find();
        } // เพิ่งเพิ่มอุปกรณ์ใหม่
        if (!id && !this.warnedUnknown.has(key)) {
            this.warnedUnknown.add(key);
            this.log.warn(`ไม่รู้จักอุปกรณ์ "${key}" (ต้องมีใน devices.id หรือ devices.mac_address) จึงไม่รับข้อมูล`);
        }
        return id;
    }
    async touch(deviceId, key) {
        const st = this.state.get(deviceId) ?? { lastSeenMs: 0 };
        st.lastSeenMs = this.now();
        st.key = key;
        const becameOnline = st.online !== true;
        st.online = true;
        this.state.set(deviceId, st);
        if (becameOnline)
            await this.store.setDeviceStatus(deviceId, true);
    }
    async markOffline(deviceId) {
        const st = this.state.get(deviceId) ?? { lastSeenMs: 0 };
        if (st.online === false)
            return;
        st.online = false;
        this.state.set(deviceId, st);
        await this.store.setDeviceStatus(deviceId, false);
    }
    // ---------- ข้อความจาก MQTT ----------
    // ประมวลผลทีละข้อความต่ออุปกรณ์ (ตามลำดับที่มาถึง) กันข้อมูลเข้า DB สลับลำดับ
    queues = new Map();
    enqueue(topic, payload) {
        const key = topic.split('/').slice(-2, -1)[0] ?? '';
        const next = (this.queues.get(key) ?? Promise.resolve()).then(() => this.handleMessage(topic, payload));
        this.queues.set(key, next);
        void next.finally(() => { if (this.queues.get(key) === next)
            this.queues.delete(key); });
        return next;
    }
    async handleMessage(topic, payload) {
        try {
            const farmSensor = this.cfg.farm ? parseFarmTopic(this.cfg.farm.prefix, topic) : null;
            if (farmSensor) {
                await this.onFarm(farmSensor, payload);
                return;
            }
            const t = parseTopic(this.cfg.topicPrefix, topic);
            if (!t)
                return;
            const deviceId = await this.resolve(t.key);
            if (!deviceId)
                return;
            const text = payload.toString('utf8').trim();
            if (t.kind === 'status') {
                const s = text.toLowerCase();
                if (s === 'online')
                    await this.touch(deviceId, t.key);
                else if (s === 'offline')
                    await this.markOffline(deviceId);
                else
                    this.log.warn(`status ที่ไม่รู้จักจาก ${t.key}: "${text.slice(0, 40)}"`);
                return;
            }
            let json;
            try {
                json = JSON.parse(text);
            }
            catch {
                this.log.warn(`${t.kind} จาก ${t.key} ไม่ใช่ JSON`);
                return;
            }
            if (t.kind === 'telemetry')
                await this.onTelemetry(deviceId, t.key, json);
            else
                await this.onAck(deviceId, json);
        }
        catch (e) {
            this.log.error('handleMessage ผิดพลาด', topic, e instanceof Error ? e.message : e);
        }
    }
    async onTelemetry(deviceId, key, json) {
        const parsed = parseTelemetry(json, this.now());
        if (!parsed) {
            this.log.warn(`telemetry จาก ${key} ใช้ไม่ได้ (ไม่มีค่าเซนเซอร์ที่ถูกต้อง)`);
            return;
        }
        if (parsed.rejected.length)
            this.log.warn(`telemetry จาก ${key} ทิ้งบางค่า: ${parsed.rejected.join('; ')}`);
        await this.touch(deviceId, key);
        // จำกัดความถี่การบันทึก: ทุกแถวที่ insert จะยิง Database Webhook ไป Edge Function
        const gap = this.cfg.minInsertIntervalSec * 1000;
        const last = this.lastInsert.get(deviceId) ?? -Infinity;
        if (gap > 0 && this.now() - last < gap)
            return;
        this.lastInsert.set(deviceId, this.now());
        await this.store.insertSensorLog(deviceId, parsed.row, parsed.recordedAt);
    }
    // ---------- ข้อมูลจากเฟิร์มแวร์ (รูปแบบ farm/<sensor>/data ไม่มี device ID ไม่มี timestamp) ----------
    farmLatest = new Map(); // คอลัมน์ -> { value, at } ค่าล่าสุดของแต่ละเซนเซอร์ (แต่ละเซนเซอร์ส่งคนละ topic)
    farmDeviceId() {
        const want = this.cfg.farm.device;
        if (want) {
            const id = UUID.test(want) ? want.toLowerCase() : this.byMac.get(normalizeMac(want));
            return id && this.devices.has(id) ? id : null;
        }
        return this.devices.size === 1 ? [...this.devices.keys()][0] : null; // มีบอร์ดเดียวใน DB
    }
    async onFarm(sensor, payload) {
        let json;
        try {
            json = JSON.parse(payload.toString('utf8'));
        }
        catch {
            this.log.warn(`farm/${sensor} ไม่ใช่ JSON`);
            return;
        }
        let deviceId = this.farmDeviceId();
        if (!deviceId && this.now() - this.lastRefresh > 10_000) {
            await this.refreshDevices();
            deviceId = this.farmDeviceId();
        }
        if (!deviceId) {
            if (!this.warnedUnknown.has('farm')) {
                this.warnedUnknown.add('farm');
                this.log.warn('รับข้อมูล farm/* แต่หาบอร์ดไม่เจอ: ตั้ง FARM_DEVICE เป็น devices.id หรือ MAC (หรือให้มีบอร์ดเดียวใน DB)');
            }
            return;
        }
        const r = parseFarmPayload(sensor, json, { probeCm: this.cfg.farm.probeCm });
        if (r.skip) {
            this.log.warn(`farm/${sensor} ข้าม: ${r.skip}`);
            await this.touch(deviceId, 'farm'); // ยังถือว่าบอร์ดออนไลน์ (ส่งข้อความมา แค่เซนเซอร์ไม่พร้อม)
            return;
        }
        await this.touch(deviceId, 'farm');
        this.farmLatest.set(r.col, { value: r.value, at: this.now() });
        const gap = this.cfg.minInsertIntervalSec * 1000;
        const last = this.lastInsert.get(deviceId) ?? -Infinity;
        if (gap > 0 && this.now() - last < gap)
            return;
        this.lastInsert.set(deviceId, this.now());
        // รวมค่าล่าสุดของทุกเซนเซอร์ที่เพิ่งส่งมา (ภายใน 20 วินาที) เป็นแถวเดียว
        const row = {};
        for (const [col, v] of this.farmLatest)
            if (this.now() - v.at <= 20_000)
                row[col] = v.value;
        await this.store.insertSensorLog(deviceId, row);
    }
    // ---------- คำสั่งควบคุม (Dashboard -> control_commands -> MQTT -> ESP32) ----------
    async dispatch(cmd) {
        if (cmd.status !== 'pending' || this.dispatched.has(cmd.id))
            return;
        this.dispatched.add(cmd.id);
        try {
            if (this.now() - Date.parse(cmd.created_at) > this.cfg.commandTtlSec * 1000)
                return; // ปล่อยให้ sweep ตั้ง expired
            const fail = async (why) => {
                this.log.warn(`คำสั่ง ${cmd.id} ล้มเหลว: ${why}`);
                await this.store.updateCommand(cmd.id, { status: 'failed', acked_at: new Date(this.now()).toISOString() });
            };
            if (!cmd.actuator_id)
                return fail('ไม่มี actuator_id');
            const act = await this.store.getActuator(cmd.actuator_id);
            if (!act)
                return fail('ไม่พบ actuator');
            if (this.cfg.farm && act.name === this.cfg.farm.growlightActuator)
                return await this.dispatchGrowlight(cmd, act, fail);
            const bad = this.validate(cmd, act);
            if (bad)
                return fail(bad);
            const st = this.state.get(cmd.device_id);
            if (st?.online === false)
                return fail('อุปกรณ์ออฟไลน์');
            const dev = this.devices.get(cmd.device_id);
            const key = st?.key ?? (dev?.mac_address ? normalizeMac(dev.mac_address) : cmd.device_id);
            const msg = {
                id: cmd.id, actuator: act.name, kind: act.kind, channel: act.channel,
                command: cmd.command, value: cmd.value,
                ...(cmd.command === 'set_mode' ? { mode: cmd.value === 1 ? 'manual' : 'auto' } : {}),
            };
            await new Promise((resolve, reject) => {
                this.mqtt.publish(cmdTopic(this.cfg.topicPrefix, key), JSON.stringify(msg), { qos: 1 }, (err) => (err ? reject(err) : resolve()));
            }).catch(async (e) => { await fail(`ส่ง MQTT ไม่สำเร็จ: ${e.message}`); });
        }
        catch (e) {
            this.log.error('dispatch ผิดพลาด', cmd.id, e instanceof Error ? e.message : e);
        }
    }
    // ไฟปลูก: firmware รับที่ farm/growlight/command (value 0-255) และไม่ส่ง ack กลับ
    // จึงถือว่าสำเร็จเมื่อ broker รับข้อความแล้ว และอัปเดตสถานะ actuator ตามที่สั่งเอง
    async dispatchGrowlight(cmd, act, fail) {
        if (cmd.command === 'set_mode') { // โหมด auto/manual เป็นเรื่องฝั่งระบบ ไม่ต้องส่งให้บอร์ด
            if (cmd.value !== 0 && cmd.value !== 1)
                return fail('set_mode ต้องส่ง value 0 (auto) หรือ 1 (manual)');
            await this.store.updateActuator(act.id, { mode: cmd.value === 1 ? 'manual' : 'auto' });
            await this.store.updateCommand(cmd.id, { status: 'acked', acked_at: new Date(this.now()).toISOString() });
            return;
        }
        const msg = growlightMessage(cmd.command, cmd.value, new Date(this.now()).toISOString());
        if (!msg)
            return fail(`ไฟปลูกไม่รองรับ ${cmd.command} ${cmd.value ?? ''}`.trim());
        if (this.state.get(cmd.device_id)?.online === false)
            return fail('อุปกรณ์ออฟไลน์');
        let failed = null;
        await new Promise((resolve, reject) => {
            this.mqtt.publish(growlightTopic(this.cfg.farm.prefix), JSON.stringify(msg), { qos: 1 }, (err) => (err ? reject(err) : resolve()));
        }).catch((e) => { failed = e.message; });
        if (failed)
            return fail(`ส่ง MQTT ไม่สำเร็จ: ${failed}`);
        await this.store.updateActuator(act.id, { duty_pct: Math.round(msg.percentage), is_on: msg.value > 0 });
        await this.store.updateCommand(cmd.id, { status: 'acked', acked_at: new Date(this.now()).toISOString() });
    }
    validate(cmd, act) {
        if (act.kind === 'relay' && !['on', 'off', 'set_mode'].includes(cmd.command))
            return `รีเลย์ไม่รองรับ ${cmd.command}`;
        if (act.kind === 'pwm' && !['set_duty', 'set_mode'].includes(cmd.command))
            return `PWM ไม่รองรับ ${cmd.command}`;
        if (cmd.command === 'set_duty' && !(typeof cmd.value === 'number' && cmd.value >= 0 && cmd.value <= 100))
            return 'duty ต้องเป็น 0-100';
        if (cmd.command === 'set_mode' && cmd.value !== 0 && cmd.value !== 1)
            return 'set_mode ต้องส่ง value 0 (auto) หรือ 1 (manual)';
        return null;
    }
    async onAck(_deviceId, json) {
        if (typeof json !== 'object' || json === null)
            return;
        const a = json;
        if (typeof a.id !== 'string') {
            this.log.warn('ack ไม่มี id');
            return;
        }
        const cmd = await this.store.getCommand(a.id);
        if (!cmd) {
            this.log.warn(`ack ของคำสั่งที่ไม่มีอยู่: ${a.id}`);
            return;
        }
        if (cmd.status === 'acked' || cmd.status === 'failed')
            return; // ซ้ำ
        const ok = a.ok === true;
        await this.store.updateCommand(cmd.id, { status: ok ? 'acked' : 'failed', acked_at: new Date(this.now()).toISOString() });
        if (!ok || !cmd.actuator_id)
            return;
        const s = a.state ?? {};
        const patch = {};
        if (typeof s.is_on === 'boolean')
            patch.is_on = s.is_on;
        if (typeof s.duty_pct === 'number')
            patch.duty_pct = Math.max(0, Math.min(100, Math.round(s.duty_pct)));
        if (s.mode === 'auto' || s.mode === 'manual')
            patch.mode = s.mode;
        if (Object.keys(patch).length === 0) { // อุปกรณ์ไม่ได้ส่ง state มา: อนุมานจากคำสั่ง
            if (cmd.command === 'on')
                patch.is_on = true;
            else if (cmd.command === 'off')
                patch.is_on = false;
            else if (cmd.command === 'set_duty' && cmd.value !== null) {
                patch.duty_pct = cmd.value;
                patch.is_on = cmd.value > 0;
            }
            else if (cmd.command === 'set_mode')
                patch.mode = cmd.value === 1 ? 'manual' : 'auto';
        }
        await this.store.updateActuator(cmd.actuator_id, patch);
    }
    // ---------- งานที่ทำเป็นรอบ ----------
    async sweep() {
        const nowMs = this.now();
        // 1) อุปกรณ์เงียบเกินกำหนด = ออฟไลน์
        for (const [id, st] of this.state) {
            if (st.online === true && nowMs - st.lastSeenMs > this.cfg.offlineAfterSec * 1000)
                await this.markOffline(id);
        }
        // 2) คำสั่งที่รอ ack เกินเวลา = expired
        const n = await this.store.expirePending(new Date(nowMs - this.cfg.commandTtlSec * 1000).toISOString());
        if (n > 0)
            this.log.warn(`คำสั่งหมดเวลา (ไม่มี ack) ${n} รายการ`);
        // 3) เก็บตกคำสั่งที่ Realtime อาจพลาด/ที่ค้างตอน Bridge เพิ่งเริ่ม
        for (const c of await this.store.listPending())
            await this.dispatch(c);
    }
}

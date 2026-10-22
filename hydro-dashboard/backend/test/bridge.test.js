import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Bridge } from '../src/bridge.js';
import { MemoryStore, connect, sleep, silent, startBroker, waitFor } from './helpers.js';
const P = 'hydro';
const DEV = '11111111-1111-1111-1111-111111111111';
const MAC = 'AA:BB:CC:11:22:33';
const KEY = 'aabbcc112233';
const ACT_R = 'a0000000-0000-0000-0000-000000000001'; // รีเลย์
const ACT_P = 'a0000000-0000-0000-0000-000000000002'; // PWM
let broker;
const clients = [];
const bridges = [];
before(async () => { broker = await startBroker(); });
after(async () => {
    for (const b of bridges)
        b.stop();
    for (const c of clients)
        c.end(true);
    await broker.close();
});
async function setup(cfg = {}, now = () => Date.now()) {
    const store = new MemoryStore();
    store.devices = [{ id: DEV, mac_address: MAC }];
    store.actuators = [
        { id: ACT_R, device_id: DEV, name: 'relay_1_temp', kind: 'relay', channel: 1 },
        { id: ACT_P, device_id: DEV, name: 'circ_pump', kind: 'pwm', channel: null },
    ];
    const bc = await connect(broker.url);
    clients.push(bc);
    const dev = await connect(broker.url);
    clients.push(dev);
    const prefix = `${P}${Math.random().toString(16).slice(2, 6)}`; // แยกแต่ละเทสต์ไม่ให้ข้อความปนกัน
    const bridge = new Bridge(bc, store, { topicPrefix: prefix, minInsertIntervalSec: 0, commandTtlSec: 30, offlineAfterSec: 120, ...cfg }, silent, now);
    bridges.push(bridge);
    await bridge.start();
    await sleep(50);
    const pub = (kind, payload, key = KEY) => dev.publish(`${prefix}/${key}/${kind}`, typeof payload === 'string' ? payload : JSON.stringify(payload), { qos: 1 });
    return { store, bridge, dev, prefix, pub };
}
const cmd = (over) => ({
    id: 'c' + Math.random().toString(16).slice(2, 10) + '-0000-0000-0000-000000000000', device_id: DEV, actuator_id: ACT_R,
    command: 'on', value: null, status: 'pending', created_at: new Date().toISOString(), ...over,
});
test('telemetry (ระบุอุปกรณ์ด้วย MAC) → sensor_logs และตั้งออนไลน์ครั้งเดียว', async () => {
    const { store, pub } = await setup();
    pub('telemetry', { ph: 6.1, temperature: 26, light_lux: 5000 });
    pub('telemetry', { ph: 6.2 });
    await waitFor(() => store.logs.length === 2);
    assert.equal(store.logs[0].deviceId, DEV);
    assert.deepEqual(store.logs[0].row, { ph: 6.1, temperature: 26, light_lux: 5000 });
    assert.deepEqual(store.statusCalls, [{ deviceId: DEV, online: true }]);
});
test('ระบุอุปกรณ์ด้วย devices.id (uuid) ก็ได้', async () => {
    const { store, pub } = await setup();
    pub('telemetry', { ph: 6.3 }, DEV);
    await waitFor(() => store.logs.length === 1);
    assert.equal(store.logs[0].deviceId, DEV);
});
test('อุปกรณ์ที่ไม่รู้จักถูกเมินและไม่ทำให้ล่ม', async () => {
    const { store, pub } = await setup();
    pub('telemetry', { ph: 6 }, 'ffffffffffff');
    pub('telemetry', { ph: 6.4 });
    await waitFor(() => store.logs.length === 1);
    assert.equal(store.logs.length, 1);
});
test('ข้อมูลเสีย (ไม่ใช่ JSON / ไม่มีค่าที่ใช้ได้) ถูกเมิน', async () => {
    const { store, pub } = await setup();
    pub('telemetry', 'not json{{');
    pub('telemetry', { hello: 'world' });
    pub('telemetry', { ph: 99 });
    pub('telemetry', { ph: 6.5 });
    await waitFor(() => store.logs.length === 1);
    assert.deepEqual(store.logs[0].row, { ph: 6.5 });
});
test('จำกัดความถี่บันทึก: ส่งรัวๆ บันทึกแค่ครั้งเดียวต่อช่วง', async () => {
    let t = 1_000_000;
    const { store, pub } = await setup({ minInsertIntervalSec: 30 }, () => t);
    pub('telemetry', { ph: 6.0 });
    pub('telemetry', { ph: 6.1 });
    pub('telemetry', { ph: 6.2 });
    await waitFor(() => store.logs.length >= 1);
    await sleep(150);
    assert.equal(store.logs.length, 1);
    t += 31_000;
    pub('telemetry', { ph: 6.9 });
    await waitFor(() => store.logs.length === 2);
    assert.deepEqual(store.logs[1].row, { ph: 6.9 });
});
test('status: Last Will offline → ตั้งออฟไลน์ / online → ออนไลน์', async () => {
    const { store, pub } = await setup();
    pub('status', 'online');
    await waitFor(() => store.statusCalls.length === 1);
    pub('status', 'offline');
    await waitFor(() => store.statusCalls.length === 2);
    assert.deepEqual(store.statusCalls.map((s) => s.online), [true, false]);
});
test('เงียบเกิน offlineAfter → sweep ตั้งออฟไลน์', async () => {
    let t = 5_000_000;
    const { store, bridge, pub } = await setup({ offlineAfterSec: 120 }, () => t);
    pub('telemetry', { ph: 6 });
    await waitFor(() => store.logs.length === 1);
    t += 100_000;
    await bridge.sweep();
    assert.equal(store.statusCalls.at(-1)?.online, true);
    t += 30_000;
    await bridge.sweep();
    assert.equal(store.statusCalls.at(-1)?.online, false);
});
test('คำสั่งเปิดรีเลย์: ส่งไป ESP32 ทาง MQTT แล้วรับ ack → acked + อัปเดตสถานะ actuator', async () => {
    const { store, dev, prefix, pub } = await setup();
    pub('status', 'online');
    await waitFor(() => store.statusCalls.length === 1);
    const got = [];
    dev.subscribe(`${prefix}/${KEY}/cmd`, { qos: 1 });
    dev.on('message', (_t, b) => got.push(JSON.parse(b.toString())));
    await sleep(50);
    const c = cmd({ command: 'on' });
    store.insertCommand(c);
    await waitFor(() => got.length === 1);
    assert.equal(got[0].id, c.id);
    assert.equal(got[0].actuator, 'relay_1_temp');
    assert.equal(got[0].command, 'on');
    assert.equal(got[0].channel, 1);
    assert.equal(got[0].kind, 'relay');
    pub('ack', { id: c.id, ok: true, state: { is_on: true } });
    await waitFor(() => c.status === 'acked');
    assert.deepEqual(store.actuatorState.get(ACT_R), { is_on: true });
    assert.ok(store.acked.has(c.id));
});
test('ack ไม่ส่ง state → อนุมานจากคำสั่ง (set_duty 60, set_mode manual)', async () => {
    const { store, dev, prefix, pub } = await setup();
    const got = [];
    dev.subscribe(`${prefix}/${KEY}/cmd`, { qos: 1 });
    dev.on('message', (_t, b) => got.push(JSON.parse(b.toString())));
    pub('status', 'online');
    await sleep(80);
    const d = cmd({ actuator_id: ACT_P, command: 'set_duty', value: 60 });
    store.insertCommand(d);
    await waitFor(() => got.length === 1);
    pub('ack', { id: d.id, ok: true });
    await waitFor(() => d.status === 'acked');
    assert.deepEqual(store.actuatorState.get(ACT_P), { duty_pct: 60, is_on: true });
    const m = cmd({ actuator_id: ACT_P, command: 'set_mode', value: 1 });
    store.insertCommand(m);
    await waitFor(() => got.length === 2);
    assert.equal(got[1].mode, 'manual');
    pub('ack', { id: m.id, ok: true });
    await waitFor(() => m.status === 'acked');
    assert.deepEqual(store.actuatorState.get(ACT_P), { duty_pct: 60, is_on: true, mode: 'manual' });
});
test('ack ok:false → failed และไม่แตะสถานะ actuator', async () => {
    const { store, dev, prefix, pub } = await setup();
    const got = [];
    dev.subscribe(`${prefix}/${KEY}/cmd`, { qos: 1 });
    dev.on('message', (_t, b) => got.push(b));
    pub('status', 'online');
    await sleep(80);
    const c = cmd({});
    store.insertCommand(c);
    await waitFor(() => got.length === 1);
    pub('ack', { id: c.id, ok: false });
    await waitFor(() => c.status === 'failed');
    assert.equal(store.actuatorState.size, 0);
});
test('ack ซ้ำไม่ทำงานซ้ำ / ack ของคำสั่งที่ไม่มีอยู่ไม่ทำให้ล่ม', async () => {
    const { store, dev, prefix, pub } = await setup();
    const got = [];
    dev.subscribe(`${prefix}/${KEY}/cmd`, { qos: 1 });
    dev.on('message', (_t, b) => got.push(b));
    pub('status', 'online');
    await sleep(80);
    const c = cmd({});
    store.insertCommand(c);
    await waitFor(() => got.length === 1);
    pub('ack', { id: c.id, ok: true });
    await waitFor(() => c.status === 'acked');
    store.actuatorState.clear();
    pub('ack', { id: c.id, ok: true });
    pub('ack', { id: 'no-such', ok: true });
    await sleep(150);
    assert.equal(store.actuatorState.size, 0);
});
test('คำสั่งที่ใช้ไม่ได้ (PWM สั่ง on / duty นอกช่วง / set_mode ค่าผิด) → failed ทันที ไม่ส่ง MQTT', async () => {
    const { store, dev, prefix, pub } = await setup();
    const got = [];
    dev.subscribe(`${prefix}/${KEY}/cmd`, { qos: 1 });
    dev.on('message', (_t, b) => got.push(b));
    pub('status', 'online');
    await sleep(80);
    const a = cmd({ actuator_id: ACT_P, command: 'on' });
    const b = cmd({ actuator_id: ACT_P, command: 'set_duty', value: 150 });
    const m = cmd({ command: 'set_mode', value: 5 });
    const r = cmd({ command: 'set_duty', value: 50 }); // รีเลย์ไม่รองรับ duty
    for (const c of [a, b, m, r])
        store.insertCommand(c);
    await waitFor(() => [a, b, m, r].every((c) => c.status === 'failed'));
    await sleep(100);
    assert.equal(got.length, 0);
});
test('อุปกรณ์ที่รู้ว่าออฟไลน์ → คำสั่ง failed ทันที', async () => {
    const { store, dev, prefix, pub } = await setup();
    const got = [];
    dev.subscribe(`${prefix}/${KEY}/cmd`, { qos: 1 });
    dev.on('message', (_t, b) => got.push(b));
    pub('status', 'online');
    pub('status', 'offline');
    await waitFor(() => store.statusCalls.length === 2);
    const c = cmd({});
    store.insertCommand(c);
    await waitFor(() => c.status === 'failed');
    await sleep(100);
    assert.equal(got.length, 0);
});
test('คำสั่งไม่มี ack เกิน TTL → expired', async () => {
    let t = Date.now();
    const { store, bridge } = await setup({ commandTtlSec: 30 }, () => t);
    const c = cmd({ created_at: new Date(t).toISOString() });
    store.commands.push(c); // อยู่ในตาราง แต่ยังไม่มี ack
    t += 31_000;
    await bridge.sweep();
    assert.equal(c.status, 'expired');
});
test('ตอน Bridge เริ่ม: คำสั่งที่ค้างและยังไม่หมดอายุถูกส่ง, คำสั่งเก่าถูกตั้ง expired ไม่ส่ง', async () => {
    const store = new MemoryStore();
    store.devices = [{ id: DEV, mac_address: MAC }];
    store.actuators = [{ id: ACT_R, device_id: DEV, name: 'relay_1_temp', kind: 'relay', channel: 1 }];
    const fresh = cmd({ created_at: new Date().toISOString() });
    const old = cmd({ created_at: new Date(Date.now() - 600_000).toISOString() });
    store.commands.push(fresh, old);
    const bc = await connect(broker.url);
    clients.push(bc);
    const dev = await connect(broker.url);
    clients.push(dev);
    const prefix = 'boot' + Math.random().toString(16).slice(2, 6);
    const got = [];
    dev.subscribe(`${prefix}/${KEY}/cmd`, { qos: 1 });
    dev.on('message', (_t, b) => got.push(JSON.parse(b.toString())));
    const bridge = new Bridge(bc, store, { topicPrefix: prefix, minInsertIntervalSec: 0, commandTtlSec: 30, offlineAfterSec: 120 }, silent);
    bridges.push(bridge);
    await bridge.start();
    await waitFor(() => got.length === 1);
    assert.equal(got[0].id, fresh.id);
    assert.equal(old.status, 'expired');
    assert.equal(got.length, 1);
});

// ทดสอบตามเอกสาร "สัญญาข้อมูล MQTT: Firmware → Backend" (topic farm/*)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { parseFarmPayload, parseFarmTopic, growlightMessage, farmSubscriptions } from '../src/farm.js'
import { Bridge } from '../src/bridge.js'
import { loadConfig } from '../src/config.js'
import { MemoryStore, connect, sleep, silent, startBroker, waitFor } from './helpers.js'

test('topic: รู้จักเฉพาะ farm/<waterlevel|light|ph>/data', () => {
  assert.equal(parseFarmTopic('farm', 'farm/ph/data'), 'ph')
  assert.equal(parseFarmTopic('farm', 'farm/waterlevel/data'), 'waterlevel')
  assert.equal(parseFarmTopic('farm', 'farm/growlight/command'), null)
  assert.equal(parseFarmTopic('farm', 'farm/temp/data'), null)
  assert.equal(parseFarmTopic('farm', 'other/ph/data'), null)
  assert.deepEqual(farmSubscriptions('farm'), ['farm/waterlevel/data', 'farm/light/data', 'farm/ph/data'])
})
test('ระดับน้ำ: percent -> cm ตามความยาวแผ่น (4 ซม.)', () => {
  assert.deepEqual(parseFarmPayload('waterlevel', { mv: 1204, percent: 75.4 }), { col: 'water_level_cm', value: 3 })
  assert.deepEqual(parseFarmPayload('waterlevel', { mv: 1, percent: 100 }, { probeCm: 4 }), { col: 'water_level_cm', value: 4 })
  assert.deepEqual(parseFarmPayload('waterlevel', { percent: 0 }), { col: 'water_level_cm', value: 0 })
  assert.ok(parseFarmPayload('waterlevel', { percent: 101 }).skip)
  assert.ok(parseFarmPayload('waterlevel', { mv: 5 }).skip)
})
test('แสง: lux -> light_lux (level ไม่ใช้เก็บ)', () => {
  assert.deepEqual(parseFarmPayload('light', { lux: 62.7, level: 1 }), { col: 'light_lux', value: 62.7 })
  assert.ok(parseFarmPayload('light', { lux: -1 }).skip)
  assert.ok(parseFarmPayload('light', { level: 2 }).skip)
})
test('pH: valid=1 เก็บ, valid=0 ข้าม (ตามเอกสาร)', () => {
  assert.deepEqual(parseFarmPayload('ph', { ph: 6.86, v: 2.646, valid: 1 }), { col: 'ph', value: 6.86 })
  assert.ok(parseFarmPayload('ph', { v: 0.142, valid: 0 }).skip)
  assert.ok(parseFarmPayload('ph', { ph: 6.5, valid: 0 }).skip)
  assert.ok(parseFarmPayload('ph', { ph: 15, valid: 1 }).skip)
})
test('payload ที่ไม่ใช่ object ถูกข้าม', () => {
  for (const x of [null, 5, 'a', [1]]) assert.ok(parseFarmPayload('ph', x).skip)
})
test('ไฟปลูก: on/off/set_duty -> value 0-255', () => {
  const t = '2026-10-22T12:00:00.000Z'
  assert.deepEqual(growlightMessage('set_duty', 50, t), { action: 'set_pwm', value: 128, percentage: 50.2, timestamp: t }) // ตรงตัวอย่างในเอกสาร
  assert.equal(growlightMessage('on', null, t).value, 255)
  assert.equal(growlightMessage('off', null, t).value, 0)
  assert.equal(growlightMessage('set_duty', 100, t).value, 255)
  assert.equal(growlightMessage('set_duty', 0, t).value, 0)
  assert.equal(growlightMessage('set_duty', 101, t), null)
  assert.equal(growlightMessage('set_mode', 1, t), null)
})
test('config: farm เปิดเป็นค่าเริ่มต้น ปิดได้', () => {
  const base = { HIVEMQ_URL: 'x', HIVEMQ_USERNAME: 'u', HIVEMQ_PASSWORD: 'p', SUPABASE_URL: 's', SUPABASE_SERVICE_ROLE_KEY: 'k' }
  assert.deepEqual(loadConfig(base).farm, { prefix: 'farm', device: null, probeCm: 4, growlightActuator: 'grow_light_dimmer' })
  assert.equal(loadConfig({ ...base, FARM_ENABLED: 'false' }).farm, null)
})

// ---------- ทดสอบทั้งระบบกับ broker จำลอง ----------
const DEV = '11111111-1111-1111-1111-111111111111'
const ACT = 'a0000000-0000-0000-0000-0000000000aa'
let broker; const clients = []; const bridges = []
before(async () => { broker = await startBroker() })
after(async () => { bridges.forEach((b) => b.stop()); clients.forEach((c) => c.end(true)); await broker.close() })

async function setup(farmOver = {}) {
  const store = new MemoryStore()
  store.devices = [{ id: DEV, mac_address: null }]
  store.actuators = [{ id: ACT, device_id: DEV, name: 'grow_light_dimmer', kind: 'pwm', channel: null }]
  const bc = await connect(broker.url); const dev = await connect(broker.url); clients.push(bc, dev)
  const prefix = 'farm' + Math.random().toString(16).slice(2, 6)
  const cfg = { topicPrefix: 'hydro', minInsertIntervalSec: 0, commandTtlSec: 30, offlineAfterSec: 120,
    farm: { prefix, device: null, probeCm: 4, growlightActuator: 'grow_light_dimmer', ...farmOver } }
  const bridge = new Bridge(bc, store, cfg, silent); bridges.push(bridge)
  await bridge.start(); await sleep(50)
  const pub = (s, p) => dev.publish(`${prefix}/${s}/data`, typeof p === 'string' ? p : JSON.stringify(p), { qos: 0 })
  return { store, bridge, dev, prefix, pub }
}

test('รับข้อมูลทั้ง 3 เซนเซอร์ (บอร์ดเดียว ไม่มี device ID) -> sensor_logs + ออนไลน์', async () => {
  const { store, pub } = await setup()
  pub('ph', { ph: 6.86, v: 2.646, valid: 1 }); await waitFor(() => store.logs.length === 1)
  pub('light', { lux: 62.7, level: 1 }); await waitFor(() => store.logs.length === 2)
  pub('waterlevel', { mv: 1204, percent: 75.4 }); await waitFor(() => store.logs.length === 3)
  assert.deepEqual(store.logs[0].row, { ph: 6.86 })
  assert.deepEqual(store.logs[2].row, { ph: 6.86, light_lux: 62.7, water_level_cm: 3 }) // แถวรวมค่าล่าสุดของทุกตัว
  assert.ok(store.logs.every((l) => l.deviceId === DEV))
  assert.deepEqual(store.statusCalls, [{ deviceId: DEV, online: true }])
})
test('pH valid=0 และ JSON เสีย ไม่ถูกบันทึก', async () => {
  const { store, pub } = await setup()
  pub('ph', { v: 0.142, valid: 0 }); pub('ph', 'oops{'); pub('light', { lux: 10, level: 0 })
  await waitFor(() => store.logs.length === 1); await sleep(100)
  assert.deepEqual(store.logs[0].row, { light_lux: 10 })
  assert.equal(store.logs.length, 1)
})
test('มีหลายบอร์ดใน DB แต่ไม่ได้ตั้ง FARM_DEVICE -> ไม่บันทึก (กันลงผิดบอร์ด)', async () => {
  const { store, pub, bridge } = await setup()
  store.devices.push({ id: '22222222-2222-2222-2222-222222222222', mac_address: null }); await bridge.refreshDevices()
  pub('light', { lux: 5, level: 0 }); await sleep(200)
  assert.equal(store.logs.length, 0)
})
test('ตั้ง FARM_DEVICE เป็น uuid -> ใช้บอร์ดนั้นแม้มีหลายบอร์ด', async () => {
  const s = await setup({ device: DEV })
  s.store.devices.push({ id: '22222222-2222-2222-2222-222222222222', mac_address: null }); await s.bridge.refreshDevices()
  s.pub('light', { lux: 7, level: 0 }); await waitFor(() => s.store.logs.length === 1)
  assert.equal(s.store.logs[0].deviceId, DEV)
})
test('สั่งไฟปลูก 50% -> publish farm/growlight/command value 128 + acked + อัปเดต actuator', async () => {
  const { store, dev, prefix, pub } = await setup()
  const got = []
  dev.subscribe(`${prefix}/growlight/command`, { qos: 1 }); dev.on('message', (_t, b) => got.push(JSON.parse(b.toString())))
  pub('light', { lux: 1, level: 0 }); await sleep(100)
  const c = { id: 'c1', device_id: DEV, actuator_id: ACT, command: 'set_duty', value: 50, status: 'pending', created_at: new Date().toISOString() }
  store.insertCommand(c)
  await waitFor(() => got.length === 1 && c.status === 'acked')
  assert.equal(got[0].action, 'set_pwm'); assert.equal(got[0].value, 128); assert.equal(got[0].percentage, 50.2)
  assert.ok(!Number.isNaN(Date.parse(got[0].timestamp)))
  assert.deepEqual(store.actuatorState.get(ACT), { duty_pct: 50, is_on: true })
})
test('ไฟปลูก: off -> value 0, set_mode ไม่ส่งไปบอร์ดแต่บันทึกโหมด, duty ผิด -> failed', async () => {
  const { store, dev, prefix, pub } = await setup()
  const got = []
  dev.subscribe(`${prefix}/growlight/command`, { qos: 1 }); dev.on('message', (_t, b) => got.push(JSON.parse(b.toString())))
  pub('light', { lux: 1, level: 0 }); await sleep(100)
  const mk = (id, command, value) => ({ id, device_id: DEV, actuator_id: ACT, command, value, status: 'pending', created_at: new Date().toISOString() })
  const off = mk('o1', 'off', null), mode = mk('m1', 'set_mode', 1), bad = mk('b1', 'set_duty', 500)
  for (const c of [off, mode, bad]) store.insertCommand(c)
  await waitFor(() => [off, mode, bad].every((c) => c.status !== 'pending'))
  assert.equal(off.status, 'acked'); assert.equal(mode.status, 'acked'); assert.equal(bad.status, 'failed')
  await sleep(100)
  assert.deepEqual(got.map((g) => g.value), [0]) // ส่งไปบอร์ดแค่คำสั่ง off
  assert.equal(store.actuatorState.get(ACT).mode, 'manual')
})

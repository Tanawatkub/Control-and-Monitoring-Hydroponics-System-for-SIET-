import mqtt from 'mqtt'
import { loadConfig } from './config.js'
import { SupabaseStore } from './store.js'
import { Bridge } from './bridge.js'

let cfg
try { cfg = loadConfig() } catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}

const client = mqtt.connect(cfg.hivemqUrl, {
  username: cfg.hivemqUsername,
  password: cfg.hivemqPassword,
  clientId: `hydro-bridge-${Math.random().toString(16).slice(2, 8)}`,
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 15_000,
  rejectUnauthorized: true, // ตรวจใบรับรอง TLS ของ HiveMQ Cloud (ห้ามปิด)
})
client.on('connect', () => console.log('เชื่อมต่อ HiveMQ สำเร็จ'))
client.on('reconnect', () => console.log('กำลังเชื่อมต่อ HiveMQ ใหม่...'))
client.on('offline', () => console.warn('หลุดจาก HiveMQ'))
client.on('error', (e) => console.error('MQTT error:', e.message))

const bridge = new Bridge(client, new SupabaseStore(cfg.supabaseUrl, cfg.supabaseServiceKey), cfg)
bridge.start().then(() => console.log('Bridge พร้อมทำงาน')).catch((e) => {
  console.error('เริ่ม Bridge ไม่สำเร็จ:', e instanceof Error ? e.message : e)
  process.exit(1)
})

process.on('unhandledRejection', (e) => console.error('unhandledRejection', e))
const shutdown = () => { bridge.stop(); client.end(false, () => process.exit(0)) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

// อุปกรณ์จำลอง ใช้ทดสอบ HiveMQ + Bridge โดยยังไม่ต้องมี ESP32
// คำเตือน: ข้อมูลจะถูกบันทึกลงฐานข้อมูลจริงถ้า SIM_DEVICE_KEY ตรงกับอุปกรณ์ใน devices (ลบทิ้งทีหลังได้)
//   SIM_DEVICE_KEY  = MAC address (aabbcc112233) หรือ devices.id (uuid) ที่ต้องการจำลอง
import mqtt from 'mqtt';
const url = process.env.HIVEMQ_URL, username = process.env.HIVEMQ_USERNAME, password = process.env.HIVEMQ_PASSWORD;
const key = process.env.SIM_DEVICE_KEY;
const prefix = (process.env.TOPIC_PREFIX || 'hydro').replace(/^\/+|\/+$/g, '');
const every = Number(process.env.SIM_INTERVAL_SEC || 5);
if (!url || !username || !password || !key) {
    console.error('ต้องตั้ง HIVEMQ_URL, HIVEMQ_USERNAME, HIVEMQ_PASSWORD และ SIM_DEVICE_KEY');
    process.exit(1);
}
const c = mqtt.connect(url, {
    username, password, reconnectPeriod: 3000,
    will: { topic: `${prefix}/${key}/status`, payload: Buffer.from('offline'), qos: 1, retain: true },
});
const state = { relay: {}, duty: {}, mode: {} };
const walk = (v, step, lo, hi) => Math.min(hi, Math.max(lo, v + (Math.random() - 0.5) * step));
let ph = 6.0, ec = 1.8, temp = 26, hum = 70, level = 20, lux = 5000, amp = 1.2;
c.on('connect', () => {
    console.log('จำลองอุปกรณ์', key, 'เชื่อมต่อแล้ว');
    c.publish(`${prefix}/${key}/status`, 'online', { qos: 1, retain: true });
    c.subscribe(`${prefix}/${key}/cmd`, { qos: 1 });
});
c.on('message', (_t, buf) => {
    const cmd = JSON.parse(buf.toString());
    console.log('ได้รับคำสั่ง', cmd);
    if (cmd.command === 'on' || cmd.command === 'off')
        state.relay[cmd.actuator] = cmd.command === 'on';
    if (cmd.command === 'set_duty')
        state.duty[cmd.actuator] = cmd.value;
    if (cmd.command === 'set_mode')
        state.mode[cmd.actuator] = cmd.value === 1 ? 'manual' : 'auto';
    const s = {};
    if (cmd.kind === 'relay')
        s.is_on = !!state.relay[cmd.actuator];
    if (cmd.kind === 'pwm') {
        s.duty_pct = state.duty[cmd.actuator] ?? 0;
        s.is_on = (state.duty[cmd.actuator] ?? 0) > 0;
    }
    if (state.mode[cmd.actuator])
        s.mode = state.mode[cmd.actuator];
    c.publish(`${prefix}/${key}/ack`, JSON.stringify({ id: cmd.id, ok: true, state: s }), { qos: 1 });
});
setInterval(() => {
    ph = walk(ph, 0.1, 5, 7.5);
    ec = walk(ec, 0.1, 0.8, 3);
    temp = walk(temp, 0.5, 20, 34);
    hum = walk(hum, 2, 40, 95);
    level = walk(level, 0.5, 8, 25);
    lux = walk(lux, 400, 500, 12000);
    amp = walk(amp, 0.2, 0.2, 3);
    const msg = { ph, ec, temperature: temp, humidity: hum, water_level_cm: level, light_lux: lux, current_a: amp };
    c.publish(`${prefix}/${key}/telemetry`, JSON.stringify(msg), { qos: 1 });
    console.log('ส่งข้อมูล', JSON.stringify(msg));
}, every * 1000);
process.on('SIGINT', () => { c.publish(`${prefix}/${key}/status`, 'offline', { qos: 1, retain: true }, () => c.end(false, () => process.exit(0))); });

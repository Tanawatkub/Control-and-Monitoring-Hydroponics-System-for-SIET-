// ตัวแปลงรูปแบบ MQTT ของทีมเฟิร์มแวร์ ("สัญญาข้อมูล MQTT: Firmware → Backend")
//   farm/waterlevel/data  {"mv":1204,"percent":75.4}
//   farm/light/data       {"lux":62.7,"level":1}
//   farm/ph/data          {"ph":6.86,"v":2.646,"valid":1}     (valid=0 → ไม่มีฟิลด์ ph ให้ข้าม)
//   farm/growlight/command {"action":"set_pwm","value":0-255,...}   (Backend -> ESP32)
// ฟังก์ชันในไฟล์นี้เป็นฟังก์ชันล้วน (ไม่ติดต่อเครือข่าย/DB) เพื่อให้เทสต์ง่าย

export const FARM_SENSORS = ['waterlevel', 'light', 'ph']

export function farmSubscriptions(prefix) {
  return FARM_SENSORS.map((s) => `${prefix}/${s}/data`)
}
export const growlightTopic = (prefix) => `${prefix}/growlight/command`

// farm/<sensor>/data -> '<sensor>' (ถ้าไม่ใช่ topic ของเรา คืน null)
export function parseFarmTopic(prefix, topic) {
  const p = topic.split('/')
  const pre = prefix.split('/')
  if (p.length !== pre.length + 2 || pre.some((x, i) => p[i] !== x)) return null
  const [sensor, kind] = p.slice(pre.length)
  return kind === 'data' && FARM_SENSORS.includes(sensor) ? sensor : null
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// คืน { col, value } = คอลัมน์ใน sensor_logs และค่า, หรือ { skip: 'เหตุผล' } ถ้าข้อมูลใช้ไม่ได้
export function parseFarmPayload(sensor, json, opts = { probeCm: 4 }) {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return { skip: 'payload ไม่ใช่ object' }
  const o = json
  if (sensor === 'waterlevel') {
    const pct = num(o.percent)
    if (pct === null || pct < 0 || pct > 100) return { skip: 'percent ไม่อยู่ในช่วง 0-100' }
    // เฟิร์มแวร์ส่งเป็น % ของแผ่นเซนเซอร์ยาว probeCm ซม. -> แปลงเป็น cm เพื่อเข้าคอลัมน์ water_level_cm
    return { col: 'water_level_cm', value: Math.round(((pct * opts.probeCm) / 100) * 10) / 10 }
  }
  if (sensor === 'light') {
    const lux = num(o.lux)
    if (lux === null || lux < 0 || lux > 200000) return { skip: 'lux ไม่อยู่ในช่วง 0-200000' }
    return { col: 'light_lux', value: Math.round(lux * 10) / 10 }
  }
  if (sensor === 'ph') {
    if (o.valid !== 1) return { skip: 'valid ไม่ใช่ 1 (ไม่มีสัญญาณจากโมดูล pH)' }
    const ph = num(o.ph)
    if (ph === null || ph < 0 || ph > 14) return { skip: 'ph ไม่อยู่ในช่วง 0-14' }
    return { col: 'ph', value: Math.round(ph * 100) / 100 }
  }
  return { skip: 'sensor ไม่รู้จัก' }
}

// แปลงคำสั่งจากหน้าเว็บ (on/off/set_duty 0-100%) เป็นข้อความที่ firmware เข้าใจ (value 0-255)
export function growlightMessage(command, value, nowIso) {
  let pwm
  if (command === 'on') pwm = 255
  else if (command === 'off') pwm = 0
  else if (command === 'set_duty' && typeof value === 'number' && value >= 0 && value <= 100) pwm = Math.round((value * 255) / 100)
  else return null
  return { action: 'set_pwm', value: pwm, percentage: Math.round((pwm / 255) * 1000) / 10, timestamp: nowIso }
}

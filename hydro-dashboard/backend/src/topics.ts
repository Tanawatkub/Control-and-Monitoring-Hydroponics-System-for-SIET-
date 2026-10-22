// สัญญาเรื่อง topic ระหว่าง ESP32 กับ Bridge   {key} = MAC address (ไม่มี :) หรือ devices.id (uuid)
//   {prefix}/{key}/telemetry   ESP32 -> Bridge   ข้อมูลเซนเซอร์ (JSON)
//   {prefix}/{key}/status      ESP32 -> Bridge   "online" / "offline" (retained, ตั้งเป็น Last Will = "offline")
//   {prefix}/{key}/cmd         Bridge -> ESP32   คำสั่งควบคุม (JSON)
//   {prefix}/{key}/ack         ESP32 -> Bridge   ผลการทำตามคำสั่ง (JSON)

export type TopicKind = 'telemetry' | 'status' | 'ack'

export function subscriptions(prefix: string): string[] {
  return [`${prefix}/+/telemetry`, `${prefix}/+/status`, `${prefix}/+/ack`]
}

export function cmdTopic(prefix: string, key: string): string {
  return `${prefix}/${key}/cmd`
}

export function parseTopic(prefix: string, topic: string): { key: string; kind: TopicKind } | null {
  const parts = topic.split('/')
  const p = prefix.split('/')
  if (parts.length !== p.length + 2) return null
  for (let i = 0; i < p.length; i++) if (parts[i] !== p[i]) return null
  const key = parts[p.length]
  const kind = parts[p.length + 1]
  if (!key || (kind !== 'telemetry' && kind !== 'status' && kind !== 'ack')) return null
  return { key, kind }
}

// "AA:BB:CC:11:22:33" -> "aabbcc112233"
export function normalizeMac(s: string): string {
  return s.toLowerCase().replace(/[^0-9a-f]/g, '')
}

// ทดสอบสัญญากับ Frontend: อ่านซอร์สของ Frontend จริง แล้วเช็คว่า Backend รองรับครบ
// ถ้าฝั่งใดเปลี่ยนแล้วไม่ตรงกัน เทสต์นี้จะ fail (ถ้าไม่มีโฟลเดอร์ frontend อยู่ข้าง ๆ จะข้าม)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const feDir = new URL('../../frontend/src/', import.meta.url)
const read = (u) => readFileSync(u, 'utf8')
const bridgeSrc = read(new URL('../src/bridge.js', import.meta.url))
const storeSrc = read(new URL('../src/store.js', import.meta.url))

test('สัญญา Frontend ↔ Backend (คำสั่ง สถานะ ชื่อคอลัมน์)', { skip: !existsSync(feDir) }, () => {
  const control = read(new URL('pages/Control.jsx', feDir))
  // คำสั่งที่ Frontend ส่ง: send(a, 'on'|'off'|'set_duty'|'set_mode', ...) / 'on' : 'off'
  for (const c of ['on', 'off', 'set_duty', 'set_mode']) {
    assert.ok(control.includes(`'${c}'`), `Frontend ไม่ได้ส่งคำสั่ง ${c}`)
    assert.ok(bridgeSrc.includes(`'${c}'`) || storeSrc.includes(`'${c}'`), `Backend ไม่รู้จักคำสั่ง ${c}`)
  }
  // สถานะคำสั่งที่ Frontend แสดง ต้องเป็นชุดเดียวกับที่ Backend เขียน
  for (const s of ['pending', 'acked', 'failed', 'expired']) {
    assert.ok(control.includes(s), `Frontend ไม่รู้จักสถานะ ${s}`)
    assert.ok((storeSrc + bridgeSrc).includes(s), `Backend ไม่รู้จักสถานะ ${s}`)
  }
  // ชื่อคอลัมน์ที่ Backend เขียน ต้องมีที่ Frontend อ่าน
  const all = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? all(new URL(e.name + '/', d)) : [read(new URL(e.name, d))])
  const feAll = all(feDir).join('\n')
  for (const col of ['is_online', 'last_seen', 'is_on', 'duty_pct', 'mode']) {
    assert.ok(feAll.includes(col), `Frontend ไม่ได้ใช้คอลัมน์ ${col}`)
    assert.ok((storeSrc + bridgeSrc).includes(col), `Backend ไม่ได้เขียนคอลัมน์ ${col}`)
  }
})

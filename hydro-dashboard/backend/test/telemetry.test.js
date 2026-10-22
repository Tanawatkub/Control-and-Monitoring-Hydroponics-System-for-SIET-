import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTelemetry } from '../src/telemetry.js';
import { SENSORS } from '../src/sensors/index.js';
import { parseTopic, normalizeMac } from '../src/topics.js';
test('โมดูลเซนเซอร์ครบ 7 ตัว (ไฮโดรโปนิกส์ ไม่มีความชื้นดิน) และตรงกับคอลัมน์ใน sensor_logs', () => {
    assert.deepEqual(SENSORS.map((s) => s.col).sort(), ['current_a', 'ec', 'humidity', 'light_lux', 'ph', 'temperature', 'water_level_cm']);
});
test('ค่าปกติทุกตัว', () => {
    const r = parseTelemetry({ ph: 6.123, ec: 1.8, temperature: 26.44, humidity: 70, water_level_cm: 18.5, light_lux: 5234.6, current_a: 1.234 });
    assert.deepEqual(r.row, { ph: 6.12, ec: 1.8, temperature: 26.4, humidity: 70, water_level_cm: 18.5, light_lux: 5235, current_a: 1.23 });
    assert.deepEqual(r.rejected, []);
});
test('ชื่อฟิลด์ทางเลือก (temp, hum, lux, level, amp)', () => {
    const r = parseTelemetry({ temp: 25, hum: 60, lux: 1000, level: 12, amp: 0.5, pH: 6.5 });
    assert.deepEqual(r.row, { temperature: 25, humidity: 60, light_lux: 1000, water_level_cm: 12, current_a: 0.5, ph: 6.5 });
});
test('ค่านอกช่วงถูกทิ้งเฉพาะตัวนั้น ตัวอื่นยังอยู่', () => {
    const r = parseTelemetry({ ph: 20, ec: 1.5, temperature: -100 });
    assert.deepEqual(r.row, { ec: 1.5 });
    assert.equal(r.rejected.length, 2);
});
test('สตริงตัวเลขรับได้ ข้อความ/NaN ไม่รับ', () => {
    const r = parseTelemetry({ ph: '6.4', ec: 'abc', temperature: NaN });
    assert.deepEqual(r.row, { ph: 6.4 });
});
test('ค่า 0 เป็นค่าที่ถูกต้อง (ระดับน้ำ 0 cm)', () => {
    assert.deepEqual(parseTelemetry({ water_level_cm: 0 }).row, { water_level_cm: 0 });
});
test('ไม่มีค่าที่ใช้ได้เลย / ไม่ใช่ object = null', () => {
    assert.equal(parseTelemetry({}), null);
    assert.equal(parseTelemetry({ foo: 1 }), null);
    assert.equal(parseTelemetry([1, 2]), null);
    assert.equal(parseTelemetry('x'), null);
    assert.equal(parseTelemetry(null), null);
});
test('ts: ยอมรับเวลาที่สมเหตุสมผล (วินาที/มิลลิวินาที/ISO) ทิ้งเวลาเพี้ยน', () => {
    const now = Date.parse('2026-10-22T10:00:00Z');
    const sec = Math.floor(now / 1000) - 60;
    assert.equal(parseTelemetry({ ph: 6, ts: sec }, now).recordedAt, new Date(sec * 1000).toISOString());
    assert.equal(parseTelemetry({ ph: 6, ts: sec * 1000 }, now).recordedAt, new Date(sec * 1000).toISOString());
    assert.equal(parseTelemetry({ ph: 6, ts: '2026-10-22T09:59:00Z' }, now).recordedAt, '2026-10-22T09:59:00.000Z');
    assert.equal(parseTelemetry({ ph: 6, ts: 1000 }, now).recordedAt, undefined); // ปี 1970 (ESP32 ไม่มี RTC)
    assert.equal(parseTelemetry({ ph: 6, ts: sec + 7200 }, now).recordedAt, undefined); // อนาคตไกลเกิน
});
test('topic: แยกและตรวจรูปแบบ', () => {
    assert.deepEqual(parseTopic('hydro', 'hydro/aabbcc112233/telemetry'), { key: 'aabbcc112233', kind: 'telemetry' });
    assert.equal(parseTopic('hydro', 'hydro/x/cmd'), null);
    assert.equal(parseTopic('hydro', 'other/x/telemetry'), null);
    assert.equal(parseTopic('hydro', 'hydro/a/b/telemetry'), null);
    assert.deepEqual(parseTopic('farm/a', 'farm/a/k1/ack'), { key: 'k1', kind: 'ack' });
});
test('MAC: ตัดตัวคั่นและตัวพิมพ์ใหญ่', () => {
    assert.equal(normalizeMac('AA:BB:CC:11:22:33'), 'aabbcc112233');
    assert.equal(normalizeMac('aa-bb-cc-11-22-33'), 'aabbcc112233');
});
test('ความชื้นในดินไม่ใช่เซนเซอร์ของระบบนี้ → ถูกเมิน', () => {
    assert.deepEqual(parseTelemetry({ ph: 6, soil_moisture_pct: 50, soil: 40 }).row, { ph: 6 });
});

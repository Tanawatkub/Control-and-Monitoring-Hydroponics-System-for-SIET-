import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSelectedDevice } from '../hooks/DeviceContext'
import { useThreshold } from '../hooks/data'
import type { Threshold } from '../lib/types'

type NumKey = Exclude<keyof Threshold, 'id' | 'device_id' | 'updated_at' | 'operating_mode'>

const FIELDS: { key: NumKey; label: string; unit: string }[] = [
  { key: 'ph_min', label: 'pH ต่ำสุด', unit: '' }, { key: 'ph_max', label: 'pH สูงสุด', unit: '' },
  { key: 'ec_min', label: 'EC ต่ำสุด', unit: 'mS/cm' }, { key: 'ec_max', label: 'EC สูงสุด', unit: 'mS/cm' },
  { key: 'temp_min', label: 'อุณหภูมิต่ำสุด', unit: '°C' }, { key: 'temp_max', label: 'อุณหภูมิสูงสุด', unit: '°C' },
  { key: 'humidity_min', label: 'ความชื้นอากาศต่ำสุด', unit: '%' }, { key: 'humidity_max', label: 'ความชื้นอากาศสูงสุด', unit: '%' },
  { key: 'water_level_min_cm', label: 'ระดับน้ำต่ำสุด', unit: 'cm' },
  { key: 'light_min', label: 'แสงต่ำสุด', unit: 'lux' }, { key: 'light_max', label: 'แสงสูงสุด', unit: 'lux' },
  { key: 'soil_moisture_min', label: 'ความชื้นดินต่ำสุด', unit: '%' }, { key: 'soil_moisture_max', label: 'ความชื้นดินสูงสุด', unit: '%' },
  { key: 'current_max', label: 'กระแสสูงสุด', unit: 'A' },
  { key: 'hysteresis', label: 'Hysteresis (ช่วงกันสวิตช์ถี่)', unit: '' },
]

export function Thresholds() {
  const { selectedId } = useSelectedDevice()
  const { data: th, loading, error, reload } = useThreshold(selectedId)
  const [form, setForm] = useState<Record<string, string>>({})
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!th) return
    const f: Record<string, string> = {}
    for (const { key } of FIELDS) f[key] = th[key] === null || th[key] === undefined ? '' : String(th[key])
    setForm(f)
    setMode(th.operating_mode)
  }, [th])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!th) return
    const payload: Record<string, unknown> = { operating_mode: mode, updated_at: new Date().toISOString() }
    for (const { key } of FIELDS) {
      const raw = (form[key] ?? '').trim()
      if (raw === '') payload[key] = null
      else if (Number.isNaN(Number(raw))) { setMsg({ ok: false, text: `ค่า "${key}" ไม่ใช่ตัวเลข` }); return }
      else payload[key] = Number(raw)
    }
    // RLS "staff update thresholds": เฉพาะ admin/operator การแก้ไขถูกบันทึกลง audit_logs อัตโนมัติ
    const { error } = await supabase.from('thresholds').update(payload).eq('id', th.id)
    setMsg(error ? { ok: false, text: `บันทึกไม่สำเร็จ: ${error.message}` } : { ok: true, text: 'บันทึกแล้ว' })
    if (!error) void reload()
  }

  return (
    <>
      {error && <p className="error">{error}</p>}
      {loading ? <p className="muted">กำลังโหลด...</p> : !th ? (
        <p className="muted">อุปกรณ์นี้ยังไม่มีแถวเกณฑ์ใน thresholds (ต้องให้ admin เพิ่มแถวก่อน)</p>
      ) : (
        <form className="card" onSubmit={save}>
          <p className="muted small">เว้นว่าง = ไม่ตรวจค่านั้น</p>
          <div className="formgrid">
            {FIELDS.map((f) => (
              <label key={f.key}>{f.label} {f.unit && <span className="muted small">({f.unit})</span>}
                <input inputMode="decimal" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </label>
            ))}
            <label>โหมดการทำงาน
              <select value={mode} onChange={(e) => setMode(e.target.value as 'auto' | 'manual')}>
                <option value="auto">อัตโนมัติ (auto)</option><option value="manual">แมนนวล (manual)</option>
              </select>
            </label>
          </div>
          {msg && <p className={msg.ok ? 'okmsg' : 'error'}>{msg.text}</p>}
          <button type="submit">บันทึก</button>
        </form>
      )}
    </>
  )
}

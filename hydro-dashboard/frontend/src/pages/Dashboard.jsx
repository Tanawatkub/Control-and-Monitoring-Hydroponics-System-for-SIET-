import { useState } from 'react';
import { DeviceBar } from '../components/Layout';
import { SensorCard } from '../components/SensorCard';
import { SensorChart } from '../components/SensorChart';
import { useSelectedDevice } from '../hooks/DeviceContext';
import { useHistory, useLatestReading, useThreshold } from '../hooks/data';
import { SENSORS, sensorState } from '../lib/sensors';
import { fmtTime } from '../lib/format';
export function Dashboard() {
    const { selectedId, loading: devLoading, error: devError } = useSelectedDevice();
    const { latest } = useLatestReading(selectedId);
    const { data: th } = useThreshold(selectedId);
    const [sensorKey, setSensorKey] = useState('ph');
    const [hours, setHours] = useState(6);
    const { rows, loading } = useHistory(selectedId, hours);
    const def = SENSORS.find((s) => s.key === sensorKey) ?? SENSORS[0];
    if (devLoading)
        return <p className="muted">กำลังโหลด...</p>;
    if (devError)
        return <p className="error">โหลดอุปกรณ์ไม่สำเร็จ: {devError}</p>;
    return (<>
      <div className="row between"><h2>ภาพรวม</h2><DeviceBar /></div>
      <p className="muted small">ข้อมูลล่าสุด: {fmtTime(latest?.recorded_at)} (อัปเดตสดเมื่อมีข้อมูลใหม่)</p>
      <section className="grid">
        {SENSORS.map((s) => {
            const v = latest ? latest[s.col] : null;
            return (<SensorCard key={s.key} def={s} value={v} state={sensorState(v, th, s)} active={s.key === sensorKey} onClick={() => setSensorKey(s.key)}/>);
        })}
      </section>
      <section className="card">
        <div className="row between">
          <h3>กราฟ {def.label}</h3>
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="ช่วงเวลา">
            <option value={1}>1 ชั่วโมง</option><option value={6}>6 ชั่วโมง</option>
            <option value={24}>24 ชั่วโมง</option><option value={168}>7 วัน</option>
          </select>
        </div>
        {loading ? <p className="muted">กำลังโหลดกราฟ...</p> : <SensorChart rows={rows} def={def} th={th}/>}
      </section>
    </>);
}

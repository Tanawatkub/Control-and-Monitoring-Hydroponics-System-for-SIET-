import { fmtNum } from '../lib/format';
const TEXT = { nodata: 'ไม่มีข้อมูล', ok: 'ปกติ', low: 'ต่ำกว่าเกณฑ์', high: 'สูงกว่าเกณฑ์' };
export function SensorCard({ def, value, state, active, onClick }) {
    return (<button className={`sensor ${state} ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="muted small">{def.label}</span>
      <span className="big">{fmtNum(value, def.decimals)}<small> {value === null ? '' : def.unit}</small></span>
      <span className={`badge ${state}`}>{TEXT[state]}</span>
    </button>);
}

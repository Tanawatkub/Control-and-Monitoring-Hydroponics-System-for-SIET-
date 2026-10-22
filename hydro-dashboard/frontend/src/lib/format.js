export function fmtNum(v, decimals = 1) {
    return v === null || v === undefined ? '-' : Number(v).toFixed(decimals);
}
export function fmtTime(iso) {
    if (!iso)
        return '-';
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' });
}
export function timeAgo(iso) {
    if (!iso)
        return 'ไม่เคยเชื่อมต่อ';
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60)
        return `${s} วินาทีที่แล้ว`;
    if (s < 3600)
        return `${Math.floor(s / 60)} นาทีที่แล้ว`;
    if (s < 86400)
        return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
    return `${Math.floor(s / 86400)} วันที่แล้ว`;
}

import { createContext, useContext, useEffect, useState } from 'react';
import { useDevices } from './data';
const Ctx = createContext(null);
const KEY = 'hydro.selectedDevice';
// เก็บอุปกรณ์ที่เลือกไว้ข้ามหน้า (จำใน localStorage ถ้าใช้ได้ ไม่ได้ก็ไม่เป็นไร)
function readSaved() {
    try {
        return localStorage.getItem(KEY);
    }
    catch {
        return null;
    }
}
export function DeviceProvider({ children }) {
    const { data, loading, error } = useDevices();
    const devices = data ?? [];
    const [selectedId, setSelectedId] = useState(readSaved);
    useEffect(() => {
        if (devices.length === 0)
            return;
        if (!selectedId || !devices.some((d) => d.id === selectedId))
            setSelectedId(devices[0].id);
    }, [devices, selectedId]);
    const select = (id) => {
        setSelectedId(id);
        try {
            localStorage.setItem(KEY, id);
        }
        catch { /* ignore */ }
    };
    const selected = devices.find((d) => d.id === selectedId) ?? null;
    return <Ctx.Provider value={{ devices, loading, error, selectedId, selected, select }}>{children}</Ctx.Provider>;
}
export function useSelectedDevice() {
    const v = useContext(Ctx);
    if (!v)
        throw new Error('useSelectedDevice ต้องอยู่ภายใน DeviceProvider');
    return v;
}

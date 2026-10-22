function num(env, key, def) {
    const raw = env[key];
    if (raw === undefined || raw === '')
        return def;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0)
        throw new Error(`${key} ต้องเป็นตัวเลขที่ไม่ติดลบ (ได้ "${raw}")`);
    return n;
}
export function loadConfig(env = process.env) {
    const required = ['HIVEMQ_URL', 'HIVEMQ_USERNAME', 'HIVEMQ_PASSWORD', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const missing = required.filter((k) => !env[k]);
    if (missing.length)
        throw new Error(`ยังไม่ได้ตั้งค่า .env: ${missing.join(', ')}`);
    return {
        hivemqUrl: env.HIVEMQ_URL,
        hivemqUsername: env.HIVEMQ_USERNAME,
        hivemqPassword: env.HIVEMQ_PASSWORD,
        supabaseUrl: env.SUPABASE_URL,
        supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY,
        topicPrefix: (env.TOPIC_PREFIX || 'hydro').replace(/^\/+|\/+$/g, ''),
        minInsertIntervalSec: num(env, 'MIN_INSERT_INTERVAL_SEC', 30),
        commandTtlSec: num(env, 'COMMAND_TTL_SEC', 30),
        offlineAfterSec: num(env, 'OFFLINE_AFTER_SEC', 120),
        // รูปแบบ topic ของทีมเฟิร์มแวร์ (farm/.../data) ปิดได้ด้วย FARM_ENABLED=false
        farm: (env.FARM_ENABLED ?? 'true').toLowerCase() === 'false' ? null : {
            prefix: (env.FARM_TOPIC_PREFIX || 'farm').replace(/^\/+|\/+$/g, ''),
            device: env.FARM_DEVICE || null, // devices.id หรือ MAC ของบอร์ด (ว่าง = ใช้บอร์ดเดียวที่มีใน DB)
            probeCm: num(env, 'WATER_PROBE_CM', 4), // ความยาวแผ่นวัดระดับน้ำ (ซม.) ใช้แปลง percent -> cm
            growlightActuator: env.FARM_GROWLIGHT_ACTUATOR || 'grow_light_dimmer', // ชื่อใน actuators.name
        },
    };
}

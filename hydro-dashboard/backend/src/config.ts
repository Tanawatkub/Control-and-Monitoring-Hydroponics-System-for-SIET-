export interface Config {
  hivemqUrl: string
  hivemqUsername: string
  hivemqPassword: string
  supabaseUrl: string
  supabaseServiceKey: string
  topicPrefix: string
  minInsertIntervalSec: number
  commandTtlSec: number
  offlineAfterSec: number
}

function num(env: NodeJS.ProcessEnv, key: string, def: number): number {
  const raw = env[key]
  if (raw === undefined || raw === '') return def
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) throw new Error(`${key} ต้องเป็นตัวเลขที่ไม่ติดลบ (ได้ "${raw}")`)
  return n
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const required = ['HIVEMQ_URL', 'HIVEMQ_USERNAME', 'HIVEMQ_PASSWORD', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  const missing = required.filter((k) => !env[k])
  if (missing.length) throw new Error(`ยังไม่ได้ตั้งค่า .env: ${missing.join(', ')}`)
  return {
    hivemqUrl: env.HIVEMQ_URL!,
    hivemqUsername: env.HIVEMQ_USERNAME!,
    hivemqPassword: env.HIVEMQ_PASSWORD!,
    supabaseUrl: env.SUPABASE_URL!,
    supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY!,
    topicPrefix: (env.TOPIC_PREFIX || 'hydro').replace(/^\/+|\/+$/g, ''),
    minInsertIntervalSec: num(env, 'MIN_INSERT_INTERVAL_SEC', 30),
    commandTtlSec: num(env, 'COMMAND_TTL_SEC', 30),
    offlineAfterSec: num(env, 'OFFLINE_AFTER_SEC', 120),
  }
}

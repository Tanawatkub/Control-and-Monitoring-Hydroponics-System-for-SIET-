import type { SensorModule } from './types.js'

// ความเข้มแสง (lux) → sensor_logs.light_lux
export const light: SensorModule = {
  col: 'light_lux',
  aliases: ['light_lux', 'lux', 'light'],
  min: 0,
  max: 200000,
  label: 'ความเข้มแสง',
  unit: 'lux',
  transform: (v) => Math.round(v),
}

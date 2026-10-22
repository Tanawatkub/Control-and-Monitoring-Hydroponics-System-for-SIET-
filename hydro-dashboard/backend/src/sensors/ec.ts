import type { SensorModule } from './types.js'

// EC (mS/cm) → sensor_logs.ec
export const ec: SensorModule = {
  col: 'ec',
  aliases: ['ec', 'EC', 'ec_ms_cm'],
  min: 0,
  max: 20,
  label: 'EC',
  unit: 'mS/cm',
  transform: (v) => Math.round(v * 100) / 100,
}

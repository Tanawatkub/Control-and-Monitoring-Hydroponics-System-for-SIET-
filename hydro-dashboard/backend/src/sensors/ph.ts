import type { SensorModule } from './types.js'

// pH () → sensor_logs.ph
export const ph: SensorModule = {
  col: 'ph',
  aliases: ['ph', 'pH', 'ph_value'],
  min: 0,
  max: 14,
  label: 'pH',
  unit: '',
  transform: (v) => Math.round(v * 100) / 100,
}

import type { SensorModule } from './types.js'

// กระแสไฟ (A) → sensor_logs.current_a
export const current: SensorModule = {
  col: 'current_a',
  aliases: ['current_a', 'current', 'amp', 'amps'],
  min: 0,
  max: 50,
  label: 'กระแสไฟ',
  unit: 'A',
  transform: (v) => Math.round(v * 100) / 100,
}

import type { SensorModule } from './types.js'

// ความชื้นอากาศ (%) → sensor_logs.humidity
export const humidity: SensorModule = {
  col: 'humidity',
  aliases: ['humidity', 'hum', 'rh'],
  min: 0,
  max: 100,
  label: 'ความชื้นอากาศ',
  unit: '%',
  transform: (v) => Math.round(v * 10) / 10,
}

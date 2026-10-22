import type { SensorModule } from './types.js'

// อุณหภูมิ (°C) → sensor_logs.temperature
export const temperature: SensorModule = {
  col: 'temperature',
  aliases: ['temperature', 'temp', 'temp_c', 'air_temp'],
  min: -40,
  max: 85,
  label: 'อุณหภูมิ',
  unit: '°C',
  transform: (v) => Math.round(v * 10) / 10,
}

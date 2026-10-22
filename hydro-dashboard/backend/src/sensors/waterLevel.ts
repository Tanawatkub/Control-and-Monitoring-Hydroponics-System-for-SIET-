import type { SensorModule } from './types.js'

// ระดับน้ำ (cm) → sensor_logs.water_level_cm
export const waterLevel: SensorModule = {
  col: 'water_level_cm',
  aliases: ['water_level_cm', 'water_level', 'level_cm', 'level'],
  min: 0,
  max: 500,
  label: 'ระดับน้ำ',
  unit: 'cm',
  transform: (v) => Math.round(v * 10) / 10,
}

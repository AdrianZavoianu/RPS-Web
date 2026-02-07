/**
 * Gradient color utilities for data visualization
 */

/**
 * Blue-Orange gradient for values where high = warning (drifts, rotations)
 * Blue (#3b82f6) at min → Orange (#fb923c) at max (matches desktop)
 */
export function getBlueOrangeColor(value: number, min: number, max: number): string {
  if (max === min) return 'rgb(59, 130, 246)' // All same value - use blue

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)))

  // Blue (#3b82f6) to Orange (#fb923c) interpolation
  const r = Math.round(59 + ratio * (251 - 59))
  const g = Math.round(130 + ratio * (146 - 130))
  const b = Math.round(246 + ratio * (60 - 246))

  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Orange-Blue gradient for values where low = critical (soil pressures)
 * Orange (#f59e0b) at min → Blue (#3b82f6) at max
 */
export function getOrangeBlueColor(value: number, min: number, max: number): string {
  if (max === min) return 'rgb(59, 130, 246)'

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)))

  // Orange to Blue interpolation
  const r = Math.round(245 + ratio * (59 - 245))
  const g = Math.round(158 + ratio * (130 - 158))
  const b = Math.round(11 + ratio * (246 - 11))

  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Cyan gradient for highlighting (single color intensity)
 */
export function getCyanIntensity(value: number, min: number, max: number): string {
  if (max === min) return 'rgba(103, 232, 249, 0.2)'

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const alpha = 0.1 + ratio * 0.4

  return `rgba(103, 232, 249, ${alpha})`
}

/**
 * Get gradient color based on result type
 */
export function getGradientColor(
  value: number,
  min: number,
  max: number,
  resultType: string
): string {
  // Foundation results use orange-blue (low = critical)
  if (resultType.includes('SoilPressures') || resultType.includes('VerticalDisplacements')) {
    return getOrangeBlueColor(value, min, max)
  }

  // Default: blue-orange (high = warning)
  return getBlueOrangeColor(value, min, max)
}

/**
 * Calculate min/max from an array of values
 */
export function getMinMax(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 }

  let min = Infinity
  let max = -Infinity

  for (const v of values) {
    if (v !== null && v !== undefined && !isNaN(v)) {
      if (v < min) min = v
      if (v > max) max = v
    }
  }

  if (min === Infinity) return { min: 0, max: 0 }
  return { min, max }
}

/**
 * Calculate absolute min/max (for symmetric gradients)
 */
export function getAbsMinMax(values: number[]): { min: number; max: number } {
  const { min, max } = getMinMax(values)
  const absMax = Math.max(Math.abs(min), Math.abs(max))
  return { min: -absMax, max: absMax }
}

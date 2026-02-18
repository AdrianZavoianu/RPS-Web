/**
 * Gradient color utilities for data visualization
 */

import {
  CYAN_HIGHLIGHT_RGB,
  GRADIENT_AMBER_RGB,
  GRADIENT_BLUE_RGB,
  GRADIENT_ORANGE_RGB,
} from './colors'

function interpolateRgb(
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  ratio: number
): string {
  const r = Math.round(start[0] + ratio * (end[0] - start[0]))
  const g = Math.round(start[1] + ratio * (end[1] - start[1]))
  const b = Math.round(start[2] + ratio * (end[2] - start[2]))
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Blue-Orange gradient for values where high = warning (drifts, rotations)
 * Blue (#3b82f6) at min → Orange (#fb923c) at max (matches desktop)
 */
export function getBlueOrangeColor(value: number, min: number, max: number): string {
  if (max === min) return `rgb(${GRADIENT_BLUE_RGB.join(', ')})`

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return interpolateRgb(GRADIENT_BLUE_RGB, GRADIENT_ORANGE_RGB, ratio)
}

/**
 * Orange-Blue gradient for values where low = critical (soil pressures)
 * Orange (#f59e0b) at min → Blue (#3b82f6) at max
 */
export function getOrangeBlueColor(value: number, min: number, max: number): string {
  if (max === min) return `rgb(${GRADIENT_BLUE_RGB.join(', ')})`

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return interpolateRgb(GRADIENT_AMBER_RGB, GRADIENT_BLUE_RGB, ratio)
}

/**
 * Cyan gradient for highlighting (single color intensity)
 */
export function getCyanIntensity(value: number, min: number, max: number): string {
  if (max === min) return `rgba(${CYAN_HIGHLIGHT_RGB.join(', ')}, 0.2)`

  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const alpha = 0.1 + ratio * 0.4

  return `rgba(${CYAN_HIGHLIGHT_RGB.join(', ')}, ${alpha})`
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

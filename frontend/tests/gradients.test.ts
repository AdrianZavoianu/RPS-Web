import { describe, expect, it } from 'vitest'

import {
  getAbsMinMax,
  getBlueOrangeColor,
  getCyanIntensity,
  getGradientColor,
  getMinMax,
  getOrangeBlueColor,
} from '../src/utils/gradients'

describe('gradient utilities', () => {
  it('returns blue baseline when min and max are equal', () => {
    expect(getBlueOrangeColor(10, 5, 5)).toBe('rgb(59, 130, 246)')
    expect(getOrangeBlueColor(10, 5, 5)).toBe('rgb(59, 130, 246)')
  })

  it('clamps blue-orange ratio at both ends', () => {
    expect(getBlueOrangeColor(-10, 0, 100)).toBe('rgb(59, 130, 246)')
    expect(getBlueOrangeColor(200, 0, 100)).toBe('rgb(251, 146, 60)')
  })

  it('uses amber-to-blue mapping for orange-blue gradient', () => {
    expect(getOrangeBlueColor(0, 0, 100)).toBe('rgb(245, 158, 11)')
    expect(getOrangeBlueColor(100, 0, 100)).toBe('rgb(59, 130, 246)')
  })

  it('scales cyan alpha from 0.1 to 0.5', () => {
    expect(getCyanIntensity(0, 0, 100)).toBe('rgba(103, 232, 249, 0.1)')
    expect(getCyanIntensity(100, 0, 100)).toBe('rgba(103, 232, 249, 0.5)')
    expect(getCyanIntensity(0, 0, 0)).toBe('rgba(103, 232, 249, 0.2)')
  })

  it('routes foundation-like result types to orange-blue', () => {
    expect(getGradientColor(0, 0, 100, 'SoilPressures')).toBe('rgb(245, 158, 11)')
    expect(getGradientColor(0, 0, 100, 'VerticalDisplacements')).toBe('rgb(245, 158, 11)')
    expect(getGradientColor(0, 0, 100, 'Drifts')).toBe('rgb(59, 130, 246)')
  })

  it('computes min/max defensively for empty and invalid arrays', () => {
    expect(getMinMax([])).toEqual({ min: 0, max: 0 })
    expect(getMinMax([Number.NaN])).toEqual({ min: 0, max: 0 })
    expect(getMinMax([3, -2, 8])).toEqual({ min: -2, max: 8 })
  })

  it('returns symmetric absolute range around zero', () => {
    expect(getAbsMinMax([-3, 8, 1])).toEqual({ min: -8, max: 8 })
    expect(getAbsMinMax([-9, 2])).toEqual({ min: -9, max: 9 })
  })
})


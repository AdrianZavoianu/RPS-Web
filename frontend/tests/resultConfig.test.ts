import { describe, expect, it } from 'vitest'

import { getResultTypeDecimals, getResultTypeUnit } from '../src/utils/resultConfig'

describe('result config helpers', () => {
  it('resolves decimals for normalized result types', () => {
    expect(getResultTypeDecimals('Forces_X')).toBe(0)
    expect(getResultTypeDecimals('Drifts_Y')).toBe(2)
    expect(getResultTypeDecimals('ColumnRotations_R3')).toBe(2)
  })

  it('uses provided fallback for unknown result types', () => {
    expect(getResultTypeDecimals('UnknownType', 4)).toBe(4)
    expect(getResultTypeDecimals(undefined, 3)).toBe(3)
  })

  it('resolves units for normalized result types', () => {
    expect(getResultTypeUnit('Forces_X')).toBe('kN')
    expect(getResultTypeUnit('SoilPressures_Min')).toBe('kN/m²')
    expect(getResultTypeUnit('VerticalDisplacements')).toBe('mm')
  })

  it('returns empty unit for unknown or missing types', () => {
    expect(getResultTypeUnit('UnknownType')).toBe('')
    expect(getResultTypeUnit(undefined)).toBe('')
  })
})


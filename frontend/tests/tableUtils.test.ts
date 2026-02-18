import { describe, expect, it } from 'vitest'

import { collectNumericValues, formatResultValue } from '../src/components/results/tableUtils'

describe('results table utilities', () => {
  it('collects only finite numeric values from selected columns', () => {
    const values = collectNumericValues(
      [
        { A: 1, B: 2, C: 'x', D: Number.NaN },
        { A: -4, B: Infinity, C: null, D: 0 },
        { A: '3', B: undefined, C: 6, D: -1.5 },
      ],
      ['A', 'B', 'C', 'D']
    )

    expect(values).toEqual([1, 2, -4, 0, 6, -1.5])
  })

  it('formats values according to result type precision', () => {
    expect(formatResultValue(12.75, 'Forces_X')).toBe('13')
    expect(formatResultValue(0.1234, 'Drifts_X')).toBe('0.12')
    expect(formatResultValue(1.2345, 'UnknownType')).toBe('1.23')
  })
})


import { describe, expect, it } from 'vitest'

import type { ComparisonDataset } from '../src/types'
import { buildComparisonProfileChartData, seededJitter } from '../src/components/results/comparisonUtils'

const comparisonDataset: ComparisonDataset = {
  result_type: 'Drifts',
  direction: 'X',
  metric: 'Avg',
  series: [
    { result_set_id: 1, result_set_name: 'RS-A', has_data: true, warning: null },
    { result_set_id: 2, result_set_name: 'RS-B', has_data: false, warning: 'missing' },
    { result_set_id: 3, result_set_name: 'RS-C', has_data: true, warning: null },
  ],
  rows: [
    { Story: 'L3', 'RS-A_Avg': 1.2, 'RS-C_Avg': 2.2 },
    { Story: 'L2', 'RS-A_Avg': 1.0 },
  ],
  ratio_column: null,
  warnings: [],
}

describe('comparison helpers', () => {
  it('returns null when no rows are present', () => {
    expect(
      buildComparisonProfileChartData({
        ...comparisonDataset,
        rows: [],
      })
    ).toBeNull()
  })

  it('builds chart data using only series with data', () => {
    const chartData = buildComparisonProfileChartData(comparisonDataset, 'X')
    expect(chartData).not.toBeNull()

    expect(chartData?.stories).toEqual(['L3', 'L2'])
    expect(chartData?.series).toEqual([
      {
        name: 'RS-A',
        values: [1.2, 1.0],
        color: '#4a7d89',
      },
      {
        name: 'RS-C',
        values: [2.2, 0],
        color: '#67e8f9',
      },
    ])
    expect(chartData?.unit).toBe('%')
    expect(chartData?.title).toBe('Drifts X - Avg Comparison')
  })

  it('produces deterministic jitter per seed/index', () => {
    const first = seededJitter(2, 42, 0.6)
    const second = seededJitter(2, 42, 0.6)
    const third = seededJitter(3, 42, 0.6)

    expect(first).toBe(second)
    expect(first).not.toBe(third)
    expect(first).toBeGreaterThanOrEqual(-0.3)
    expect(first).toBeLessThanOrEqual(0.3)
  })
})

import { describe, expect, it } from 'vitest'

import { buildComparisonProfileChartData } from '../src/components/results/comparisonUtils'
import { formatResultValue } from '../src/components/results/tableUtils'

describe('result formatting helpers', () => {
  it('formats values using backend-provided decimals when available', () => {
    expect(formatResultValue(1.23456, 2)).toBe('1.23')
    expect(formatResultValue(10, 0)).toBe('10')
  })

  it('falls back to raw numeric string when decimals are not provided', () => {
    expect(formatResultValue(1.23456, null)).toBe('1.23456')
    expect(formatResultValue(1.23456, undefined)).toBe('1.23456')
  })

  it('builds comparison chart data with backend metadata fields', () => {
    const chartData = buildComparisonProfileChartData(
      {
        result_type: 'Drifts',
        direction: 'X',
        metric: 'Avg',
        unit: '%',
        decimals: 2,
        series: [
          { result_set_id: 1, result_set_name: 'RS-1', has_data: true, warning: null },
          { result_set_id: 2, result_set_name: 'RS-2', has_data: true, warning: null },
        ],
        rows: [
          { Story: 'L2', 'RS-1_Avg': 0.1, 'RS-2_Avg': 0.2 },
          { Story: 'L1', 'RS-1_Avg': 0.15, 'RS-2_Avg': 0.25 },
        ],
        ratio_column: null,
        warnings: [],
      },
      'X'
    )

    expect(chartData).not.toBeNull()
    expect(chartData?.unit).toBe('%')
    expect(chartData?.decimals).toBe(2)
    expect(chartData?.series).toHaveLength(2)
  })
})

import type { ComparisonDataset, ProfileChartData } from '../../types'
import { COMPARISON_SERIES_PALETTE as COMPARISON_SERIES_COLORS } from '../../utils/colors'

export type ComparisonMetric = 'Avg' | 'Max' | 'Min'

export const COMPARISON_METRICS: ComparisonMetric[] = ['Avg', 'Max', 'Min']

export function buildComparisonProfileChartData(
  comparisonData: ComparisonDataset | null | undefined,
  direction?: string
): ProfileChartData | null {
  if (!comparisonData?.rows.length) return null

  const stories = comparisonData.rows.map((row) => String(row['Story'] || ''))
  const series = comparisonData.series
    .filter((resultSeries) => resultSeries.has_data)
    .map((resultSeries, index) => {
      const columnKey = `${resultSeries.result_set_name}_${comparisonData.metric}`
      return {
        name: resultSeries.result_set_name,
        values: comparisonData.rows.map((row) => (row[columnKey] as number) || 0),
        color: COMPARISON_SERIES_COLORS[index % COMPARISON_SERIES_COLORS.length],
      }
    })

  return {
    stories,
    series,
    result_type: comparisonData.result_type,
    unit: comparisonData.unit || '',
    decimals: comparisonData.decimals,
    title: `${comparisonData.result_type}${direction ? ` ${direction}` : ''} - ${comparisonData.metric} Comparison`,
  }
}

export function seededJitter(index: number, seed: number, amplitude = 0.6) {
  const raw = ((index + 1) * 9301 + seed * 49297) % 233280
  return (raw / 233280 - 0.5) * amplitude
}

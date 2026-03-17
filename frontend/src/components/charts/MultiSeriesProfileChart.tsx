/**
 * Multi-series profile chart that shows all load cases + average
 * This matches the RPS desktop design with selection/hover highlighting
 */

import { memo, useMemo } from 'react'
import { LazyPlot } from './LazyPlot'
import type { ResultDataset } from '../../types'
import { PROFILE_SERIES_PALETTE as PROFILE_SERIES_COLORS } from '../../utils/colors'
import {
  AVERAGE_LINE_COLOR,
  getChartColors,
  ZERO_LINE_COLOR,
} from '../../utils/colors'
import {
  PLOTLY_CONFIG_NO_MODE_BAR,
  createAxisLayout,
  withPlotlyDefaults,
} from '../../utils/plotlyDefaults'
import { getStoryAxisRange } from './chartHelpers'
import { ChartLegend } from './ChartLegend'

interface MultiSeriesProfileChartProps {
  dataset: ResultDataset
  title?: string
  height?: number
  selectedLoadCases?: Set<string>
  hoveredLoadCase?: string | null
}

function MultiSeriesProfileChartComponent({
  dataset,
  selectedLoadCases = new Set(),
  hoveredLoadCase = null,
}: MultiSeriesProfileChartProps) {
  const storyColumn = dataset.story_column || 'Story'
  const stories = useMemo(
    () => dataset.rows.map((row) => String(row[storyColumn])),
    [dataset.rows, storyColumn]
  )
  const loadCases = useMemo(
    () => dataset.load_case_columns || [],
    [dataset.load_case_columns]
  )
  const hasAvg = useMemo(
    () => dataset.summary_columns?.includes('Avg') ?? false,
    [dataset.summary_columns]
  )
  const hasSelection = selectedLoadCases.size > 0

  // Hover format based on result type decimals
  const resultType = dataset.meta?.result_type
  const decimals = typeof dataset.meta?.decimals === 'number' ? dataset.meta.decimals : null
  const hoverFormat = decimals === null ? '%{x}' : `%{x:.${decimals}f}`

  const traces = useMemo(() => {
    const traceList: Plotly.Data[] = loadCases.map((lc, idx) => {
      const baseColor = PROFILE_SERIES_COLORS[idx % PROFILE_SERIES_COLORS.length]
      const isSelected = selectedLoadCases.has(lc)
      const isHovered = hoveredLoadCase === lc

      let opacity = 1
      let width = 2

      if (isHovered) {
        opacity = 1
        width = 4
      } else if (hasSelection) {
        if (isSelected) {
          opacity = 1
          width = 3
        } else {
          opacity = 0.25
          width = 1.5
        }
      } else if (hoveredLoadCase && !isHovered) {
        opacity = 0.35
        width = 1.5
      }

      return {
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: lc,
        y: stories,
        x: dataset.rows.map((row) => row[lc] as number),
        line: {
          color: baseColor,
          width,
        },
        opacity,
        hovertemplate: `${lc}<br>%{y}: ${hoverFormat}<extra></extra>`,
      }
    })

    if (hasAvg) {
      traceList.push({
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Avg',
        y: stories,
        x: dataset.rows.map((row) => row['Avg'] as number),
        line: {
          color: AVERAGE_LINE_COLOR,
          width: 4,
          dash: 'dash',
        },
        hovertemplate: `Avg<br>%{y}: ${hoverFormat}<extra></extra>`,
      })
    }

    return traceList
  }, [dataset.rows, hasAvg, hasSelection, hoverFormat, hoveredLoadCase, loadCases, selectedLoadCases, stories])

  // Get unit and build x-axis title
  const unit = dataset.meta?.unit || ''
  const xAxisTitle = unit ? `${resultType || 'Value'} (${unit})` : (resultType || 'Value')

  // Build legend items
  const legendItems = useMemo(
    () => [
      ...loadCases.map((lc, idx) => ({
        name: lc,
        color: PROFILE_SERIES_COLORS[idx % PROFILE_SERIES_COLORS.length],
      })),
      ...(hasAvg ? [{ name: 'Avg', color: AVERAGE_LINE_COLOR, dashed: true }] : []),
    ],
    [hasAvg, loadCases]
  )

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0">
        <LazyPlot
          data={traces}
          layout={withPlotlyDefaults({
            xaxis: createAxisLayout({
              title: { text: xAxisTitle, font: { size: 14, color: getChartColors().textColor }, standoff: 8 },
              zerolinecolor: ZERO_LINE_COLOR,
              zerolinewidth: 1,
              rangemode: 'tozero',
            }),
            yaxis: createAxisLayout({
              title: { text: 'Story', font: { size: 14, color: getChartColors().textColor }, standoff: 8 },
              range: getStoryAxisRange(stories.length),
            }),
            margin: { l: 65, r: 15, t: 2, b: 45 },
            hovermode: 'closest',
          })}
          config={PLOTLY_CONFIG_NO_MODE_BAR}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
      <ChartLegend items={legendItems} />
    </div>
  )
}

export const MultiSeriesProfileChart = memo(MultiSeriesProfileChartComponent)

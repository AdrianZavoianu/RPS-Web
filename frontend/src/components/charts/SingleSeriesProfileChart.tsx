/**
 * Legacy single-series profile chart (for backward compatibility)
 * Desktop style: lines only, no markers, minimal labels
 */

import { LazyPlot } from './LazyPlot'
import type { ChartData, ProfileChartData } from '../../types'
import { PROFILE_SERIES_PALETTE as PROFILE_SERIES_COLORS } from '../../utils/colors'
import {
  getChartColors,
  PROFILE_COLOR,
  ZERO_LINE_COLOR,
} from '../../utils/colors'
import {
  PLOTLY_CONFIG_NO_MODE_BAR,
  createAxisLayout,
  withPlotlyDefaults,
} from '../../utils/plotlyDefaults'
import { getStoryAxisRange } from './chartHelpers'

interface ProfileChartProps {
  data: ChartData | ProfileChartData
  title?: string
  showLegend?: boolean
  height?: number
}

export function ProfileChart({
  data,
  height,
}: ProfileChartProps) {
  // Handle single series ChartData format
  if ('values' in data && 'stories' in data && !('series' in data)) {
    const chartData = data as ChartData
    const decimals = typeof chartData.decimals === 'number' ? chartData.decimals : null
    const hoverFormat = decimals === null ? '%{x}' : `%{x:.${decimals}f}`
    return (
      <LazyPlot
        data={[
          {
            type: 'scatter',
            mode: 'lines',
            y: chartData.stories,
            x: chartData.values,
            line: {
              color: PROFILE_COLOR,
              width: 2,
            },
            hovertemplate: `%{y}: ${hoverFormat}<extra></extra>`,
          },
        ]}
        layout={withPlotlyDefaults({
          xaxis: createAxisLayout({
            title: { text: chartData.unit || '', font: { size: 10, color: getChartColors().textColor } },
            zerolinecolor: ZERO_LINE_COLOR,
            zerolinewidth: 1,
            rangemode: 'tozero',
          }),
          yaxis: createAxisLayout({
            range: getStoryAxisRange(chartData.stories.length),
          }),
          margin: { l: 50, r: 10, t: 10, b: 30 },
        })}
        config={PLOTLY_CONFIG_NO_MODE_BAR}
        style={{ width: '100%', height: height || '100%' }}
        useResizeHandler
      />
    )
  }

  // Handle multi-series ProfileChartData format
  // Desktop style: solid for max, dashed for min
  const profileData = data as ProfileChartData
  const profileDecimals = typeof profileData.decimals === 'number' ? profileData.decimals : null
  const profileHoverFormat = profileDecimals === null ? '%{x}' : `%{x:.${profileDecimals}f}`

  return (
    <LazyPlot
      data={profileData.series.map((series, idx) => ({
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: series.name,
        y: profileData.stories,
        x: series.values,
        showlegend: true,
        line: {
          color: series.color || PROFILE_SERIES_COLORS[idx % PROFILE_SERIES_COLORS.length],
          width: series.name === 'Avg' ? 4 : 2,
          dash: series.name.includes('Min') || series.name === 'Avg' ? 'dash' : 'solid',
        },
        hovertemplate: `${series.name}<br>%{y}: ${profileHoverFormat}<extra></extra>`,
      }))}
      layout={withPlotlyDefaults({
        xaxis: createAxisLayout({
          title: {
            text: profileData.unit
              ? `${profileData.result_type || 'Value'} (${profileData.unit})`
              : (profileData.result_type || ''),
            font: { size: 14, color: getChartColors().textColor },
            standoff: 8,
          },
          zerolinecolor: ZERO_LINE_COLOR,
          zerolinewidth: 1,
          rangemode: 'tozero',
        }),
        yaxis: createAxisLayout({
          title: { text: 'Story', font: { size: 14, color: getChartColors().textColor }, standoff: 8 },
          range: getStoryAxisRange(profileData.stories.length),
        }),
        margin: { l: 65, r: 15, t: 2, b: 45 },
        showlegend: true,
        legend: {
          font: { size: 13, color: getChartColors().textColor },
          bgcolor: getChartColors().plotBgSolid,
          bordercolor: getChartColors().gridColor,
          borderwidth: 1,
          x: 1,
          xanchor: 'right' as const,
          y: 1,
          yanchor: 'top' as const,
        },
      })}
      config={PLOTLY_CONFIG_NO_MODE_BAR}
      style={{ width: '100%', height: height || '100%' }}
      useResizeHandler
    />
  )
}

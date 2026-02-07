/**
 * Building profile chart component using Plotly
 * Displays story-level results as horizontal line chart (stories on Y-axis)
 * Matches RPS desktop design: all load cases + bold dashed average line
 */

import { memo, useMemo } from 'react'
import { LazyPlot } from './LazyPlot'
import type { ChartData, ProfileChartData, ResultDataset } from '../../types'
import { PROFILE_SERIES_COLORS } from '../../utils/chartColors'
import { getResultTypeDecimals, getResultTypeUnit } from '../../utils/resultConfig'

const AVERAGE_COLOR = '#ffa500' // Orange for average line
const STORY_AXIS_TOP_PADDING = 0.2

function getStoryAxisRange(storyCount: number): [number, number] {
  if (storyCount <= 0) return [0, STORY_AXIS_TOP_PADDING]
  return [
    0,
    storyCount - 1 + STORY_AXIS_TOP_PADDING,
  ]
}

interface ProfileChartProps {
  data: ChartData | ProfileChartData
  title?: string
  showLegend?: boolean
  height?: number
}

interface MultiSeriesProfileChartProps {
  dataset: ResultDataset
  title?: string
  height?: number
  selectedLoadCases?: Set<string>
  hoveredLoadCase?: string | null
}

/**
 * Chart Legend component matching desktop style - horizontal below plot
 */
function ChartLegend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="chart-legend flex flex-wrap justify-end gap-x-4 gap-y-1 px-2 py-2">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-1.5">
          <span
            className="inline-block w-6"
            style={{
              borderTop: item.dashed ? `2px dashed ${item.color}` : `2px solid ${item.color}`,
            }}
          />
          <span className="text-text-secondary" style={{ fontSize: '13px' }}>{item.name}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Multi-series profile chart that shows all load cases + average
 * This matches the RPS desktop design with selection/hover highlighting
 */
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
  const decimals = getResultTypeDecimals(resultType)
  const hoverFormat = `%{x:.${decimals}f}`

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
          color: AVERAGE_COLOR,
          width: 4,
          dash: 'dash',
        },
        hovertemplate: `Avg<br>%{y}: ${hoverFormat}<extra></extra>`,
      })
    }

    return traceList
  }, [dataset.rows, hasAvg, hasSelection, hoverFormat, hoveredLoadCase, loadCases, selectedLoadCases, stories])

  // Get unit and build x-axis title
  const unit = getResultTypeUnit(dataset.meta?.result_type)
  const xAxisTitle = unit ? `${resultType || 'Value'} (${unit})` : (resultType || 'Value')

  // Build legend items
  const legendItems = useMemo(
    () => [
      ...loadCases.map((lc, idx) => ({
        name: lc,
        color: PROFILE_SERIES_COLORS[idx % PROFILE_SERIES_COLORS.length],
      })),
      ...(hasAvg ? [{ name: 'Avg', color: AVERAGE_COLOR, dashed: true }] : []),
    ],
    [hasAvg, loadCases]
  )

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0">
        <LazyPlot
          data={traces}
          layout={{
            xaxis: {
              title: { text: xAxisTitle, font: { size: 14, color: '#d1d5db' }, standoff: 8 },
              gridcolor: 'rgba(60, 65, 75, 0.3)',
              gridwidth: 1,
              zerolinecolor: '#4a7d89',
              zerolinewidth: 1,
              rangemode: 'tozero',
              tickfont: { size: 10 },
              linecolor: '#3a3f4a',
              linewidth: 1,
              mirror: true,
            },
            yaxis: {
              title: { text: 'Story', font: { size: 14, color: '#d1d5db' }, standoff: 8 },
              gridcolor: 'rgba(60, 65, 75, 0.3)',
              gridwidth: 1,
              tickfont: { size: 10 },
              linecolor: '#3a3f4a',
              linewidth: 1,
              mirror: true,
              range: getStoryAxisRange(stories.length),
            },
            paper_bgcolor: '#0a0c10',
            plot_bgcolor: 'rgba(22, 27, 34, 0.5)',
            font: { color: '#d1d5db', size: 11 },
            margin: { l: 65, r: 15, t: 2, b: 45 },
            showlegend: false,
            hovermode: 'closest',
            autosize: true,
          }}
          config={{
            displayModeBar: false,
            responsive: true,
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
      <ChartLegend items={legendItems} />
    </div>
  )
}

export const MultiSeriesProfileChart = memo(MultiSeriesProfileChartComponent)

/**
 * Legacy single-series profile chart (for backward compatibility)
 * Desktop style: lines only, no markers, minimal labels
 */
export function ProfileChart({
  data,
  height,
}: ProfileChartProps) {
  // Handle single series ChartData format
  if ('values' in data && 'stories' in data && !('series' in data)) {
    const chartData = data as ChartData
    return (
      <LazyPlot
        data={[
          {
            type: 'scatter',
            mode: 'lines',
            y: chartData.stories,
            x: chartData.values,
            line: {
              color: '#4a7d89',
              width: 2,
            },
            hovertemplate: '%{y}: %{x:.4f}<extra></extra>',
          },
        ]}
        layout={{
          xaxis: {
            title: { text: chartData.unit || '', font: { size: 10 } },
            gridcolor: '#2c313a',
            zerolinecolor: '#4a7d89',
            zerolinewidth: 1,
            rangemode: 'tozero',
            tickfont: { size: 10 },
          },
          yaxis: {
            gridcolor: '#2c313a',
            tickfont: { size: 10 },
            range: getStoryAxisRange(chartData.stories.length),
          },
          paper_bgcolor: '#0a0c10',
          plot_bgcolor: '#0f1419',
          font: { color: '#d1d5db', size: 11 },
          margin: { l: 50, r: 10, t: 10, b: 30 },
          showlegend: false,
          autosize: true,
        }}
        config={{
          displayModeBar: false,
          responsive: true,
        }}
        style={{ width: '100%', height: height || '100%' }}
        useResizeHandler
      />
    )
  }

  // Handle multi-series ProfileChartData format
  // Desktop style: solid for max, dashed for min
  const profileData = data as ProfileChartData

  return (
    <LazyPlot
      data={profileData.series.map((series, idx) => ({
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: series.name,
        y: profileData.stories,
        x: series.values,
        line: {
          color: series.color || PROFILE_SERIES_COLORS[idx % PROFILE_SERIES_COLORS.length],
          width: series.name === 'Avg' ? 4 : 2,
          dash: series.name.includes('Min') || series.name === 'Avg' ? 'dash' : 'solid',
        },
        hovertemplate: `${series.name}<br>%{y}: %{x:.4f}<extra></extra>`,
      }))}
      layout={{
        xaxis: {
          title: { text: profileData.unit || '', font: { size: 10 } },
          gridcolor: '#2c313a',
          zerolinecolor: '#4a7d89',
          zerolinewidth: 1,
          rangemode: 'tozero',
          tickfont: { size: 10 },
        },
        yaxis: {
          gridcolor: '#2c313a',
          tickfont: { size: 10 },
          range: getStoryAxisRange(profileData.stories.length),
        },
        paper_bgcolor: '#0a0c10',
        plot_bgcolor: '#0f1419',
        font: { color: '#d1d5db', size: 11 },
        margin: { l: 50, r: 10, t: 10, b: 30 },
        showlegend: false,
        autosize: true,
      }}
      config={{
        displayModeBar: false,
        responsive: true,
      }}
      style={{ width: '100%', height: height || '100%' }}
      useResizeHandler
    />
  )
}

// --- Pushover Curve Chart ---

interface PushoverCurveChartProps {
  points: { displacement: number; base_shear: number }[]
  caseName: string
  height?: number
}

export function PushoverCurveChart({
  points,
  height,
}: PushoverCurveChartProps) {
  const displacements = points.map((p) => p.displacement)
  const shears = points.map((p) => p.base_shear)

  return (
    <LazyPlot
      data={[
        {
          type: 'scatter',
          mode: 'lines',
          x: displacements,
          y: shears,
          line: {
            color: '#4a7d89',
            width: 2,
          },
          hovertemplate: 'D: %{x:.2f} mm<br>V: %{y:.0f} kN<extra></extra>',
        },
      ]}
      layout={{
        xaxis: {
          title: { text: 'mm', font: { size: 10 } },
          gridcolor: '#2c313a',
          zerolinecolor: '#4a7d89',
          zerolinewidth: 1,
          rangemode: 'tozero',
          tickfont: { size: 10 },
        },
        yaxis: {
          title: { text: 'kN', font: { size: 10 } },
          gridcolor: '#2c313a',
          zerolinecolor: '#4a7d89',
          zerolinewidth: 1,
          rangemode: 'tozero',
          tickfont: { size: 10 },
        },
        paper_bgcolor: '#0a0c10',
        plot_bgcolor: '#0f1419',
        font: { color: '#d1d5db', size: 11 },
        margin: { l: 50, r: 10, t: 10, b: 30 },
        showlegend: false,
        autosize: true,
      }}
      config={{
        displayModeBar: false,
        responsive: true,
      }}
      style={{ width: '100%', height: height || '100%' }}
      useResizeHandler
    />
  )
}

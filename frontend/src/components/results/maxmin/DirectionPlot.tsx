import clsx from 'clsx'
import { memo, useCallback, useMemo, useState } from 'react'
import type { MaxMinDataset } from '../../../types'
import { useThemeStore } from '../../../stores/themeStore'
import { LazyPlot } from '../../charts/LazyPlot'
import { PROFILE_SERIES_PALETTE as PROFILE_SERIES_COLORS } from '../../../utils/colors'
import {
  ACCENT_ZERO_LINE_COLOR,
  AVERAGE_LINE_COLOR,
  getChartColors,
} from '../../../utils/colors'
import {
  PLOTLY_CONFIG_NO_MODE_BAR,
  createAxisLayout,
  withPlotlyDefaults,
} from '../../../utils/plotlyDefaults'

export const STORY_AXIS_TOP_PADDING = 0.2

export interface DirectionPlotProps {
  direction: string
  data: MaxMinDataset
  loadCases: string[]
  resultType: string
  unit: string
  decimals: number | null
}

export interface DirectionTraceEntry {
  loadCase: string | null
  trace: Record<string, unknown>
}

export const DirectionPlot = memo(function DirectionPlot({
  direction,
  data,
  loadCases,
  resultType,
  unit,
  decimals,
}: DirectionPlotProps) {
  const theme = useThemeStore((s) => s.theme)
  const [selectedLoadCases, setSelectedLoadCases] = useState<Set<string>>(new Set())
  const [hoveredLoadCase, setHoveredLoadCase] = useState<string | null>(null)
  const hoverNumberFormat = decimals === null ? '%{x}' : `%{x:.${decimals}f}`
  const hoverCustomNumberFormat = decimals === null ? '%{customdata}' : `%{customdata:.${decimals}f}`

  const stories = useMemo(
    () => data.rows.map((row) => String(row['Story'])),
    [data.rows]
  )

  const toggleLoadCase = useCallback((lc: string) => {
    setSelectedLoadCases((prev) => {
      const next = new Set(prev)
      if (next.has(lc)) next.delete(lc)
      else next.add(lc)
      return next
    })
  }, [])

  const baseTraces = useMemo<DirectionTraceEntry[]>(() => {
    const traces: DirectionTraceEntry[] = []

    loadCases.forEach((lc, idx) => {
      const color = PROFILE_SERIES_COLORS[idx % PROFILE_SERIES_COLORS.length]
      const maxKey = `OrigMax_${lc}_${direction}`
      const minKey = `OrigMin_${lc}_${direction}`

      const maxValues = data.rows.map((row) => row[maxKey] as number)
      const minValues = data.rows.map((row) => row[minKey] as number | null)

      traces.push({
        loadCase: lc,
        trace: {
          type: 'scatter',
          mode: 'lines',
          name: `${lc} Max`,
          y: stories,
          x: maxValues,
          line: { color, width: 2, dash: 'solid' },
          legendgroup: lc,
          showlegend: false,
          hovertemplate: `${lc} Max<br>%{y}: ${hoverNumberFormat}<extra></extra>`,
        },
      })

      traces.push({
        loadCase: lc,
        trace: {
          type: 'scatter',
          mode: 'lines',
          name: `${lc} Min`,
          y: stories,
          x: minValues.map((value) => {
            if (value == null) return null
            return -Math.abs(value)
          }),
          line: { color, width: 2, dash: 'dash' },
          legendgroup: lc,
          showlegend: false,
          hovertemplate: `${lc} Min<br>%{y}: ${hoverCustomNumberFormat}<extra></extra>`,
          customdata: minValues,
        },
      })
    })

    if (loadCases.length > 0) {
      const avgMax = data.rows.map((row) => {
        const values = loadCases
          .map((loadCase) => row[`OrigMax_${loadCase}_${direction}`] as number)
          .filter((value) => value != null)
        return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0
      })
      const avgMinRaw = data.rows.map((row) => {
        const values = loadCases
          .map((loadCase) => row[`OrigMin_${loadCase}_${direction}`] as number)
          .filter((value) => value != null)
        return values.length ? values.reduce((total, value) => total + Math.abs(value), 0) / values.length : 0
      })
      traces.push({
        loadCase: null,
        trace: {
          type: 'scatter',
          mode: 'lines',
          name: 'Avg Max',
          y: stories,
          x: avgMax,
          line: { color: AVERAGE_LINE_COLOR, width: 5, dash: 'solid' },
          legendgroup: 'avg',
          showlegend: false,
          hovertemplate: `Avg Max<br>%{y}: ${hoverNumberFormat}<extra></extra>`,
        },
      })
      traces.push({
        loadCase: null,
        trace: {
          type: 'scatter',
          mode: 'lines',
          name: 'Avg Min',
          y: stories,
          x: avgMinRaw.map((value) => -value),
          line: { color: AVERAGE_LINE_COLOR, width: 5, dash: 'dash' },
          legendgroup: 'avg',
          showlegend: false,
          hovertemplate: `Avg Min<br>%{y}: ${hoverCustomNumberFormat}<extra></extra>`,
          customdata: avgMinRaw.map((value) => -value),
        },
      })
    }

    return traces
  }, [data.rows, loadCases, direction, hoverCustomNumberFormat, hoverNumberFormat, stories])

  const traces = useMemo<Array<Record<string, unknown>>>(() => {
    const hasSelection = selectedLoadCases.size > 0

    return baseTraces.map((entry) => {
      if (!entry.loadCase) {
        return entry.trace
      }

      const isSelected = selectedLoadCases.has(entry.loadCase)
      const isHovered = hoveredLoadCase === entry.loadCase
      let opacity = 1
      let width = 2

      if (isHovered) {
        width = 3.5
      } else if (hasSelection && !isSelected) {
        opacity = 0.25
        width = 1.5
      } else if (hasSelection && isSelected) {
        opacity = 0.6
      } else if (hoveredLoadCase && !isHovered) {
        opacity = 0.25
        width = 1.5
      }

      const line = (entry.trace as { line?: Record<string, unknown> }).line ?? {}
      return {
        ...entry.trace,
        opacity,
        line: {
          ...line,
          width,
        },
      }
    })
  }, [baseTraces, selectedLoadCases, hoveredLoadCase])

  const layout = useMemo(() => withPlotlyDefaults({
    xaxis: createAxisLayout({
      title: { text: `${resultType} (${unit})`, font: { size: 14, color: getChartColors().textColor }, standoff: 8 },
      zerolinecolor: ACCENT_ZERO_LINE_COLOR,
      zerolinewidth: 2,
      zeroline: true,
      tickfont: { size: 10, color: getChartColors().textColor },
    }),
    yaxis: createAxisLayout({
      title: { text: 'Story', font: { size: 14, color: getChartColors().textColor }, standoff: 8 },
      tickfont: { size: 10, color: getChartColors().textColor },
      range: [
        0,
        (stories.length > 0 ? stories.length - 1 : 0) + STORY_AXIS_TOP_PADDING,
      ],
    }),
    margin: { l: 50, r: 5, t: 40, b: 40 },
    hovermode: 'closest' as const,
    title: {
      text: `${direction} Direction`,
      font: { size: 14, color: getChartColors().textColor },
      x: 0.5,
      y: 0.98,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [resultType, unit, stories.length, direction, theme])

  const hasSelection = selectedLoadCases.size > 0

  return (
    <div className="maxmin-plot-section flex flex-1 min-w-0">
      <div className="flex-1 h-full">
        <LazyPlot
          data={traces}
          layout={layout}
          config={PLOTLY_CONFIG_NO_MODE_BAR}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>

      <div className="maxmin-plot-legend flex flex-col gap-0.5 pt-12 pb-6 pl-1 pr-2 w-[110px] overflow-y-auto">
        {loadCases.map((lc, idx) => {
          const color = PROFILE_SERIES_COLORS[idx % PROFILE_SERIES_COLORS.length]
          const isSelected = selectedLoadCases.has(lc)
          const isHovered = hoveredLoadCase === lc

          let itemOpacity = 1
          if (isHovered) itemOpacity = 1
          else if (hasSelection && !isSelected) itemOpacity = 0.35
          else if (hoveredLoadCase && !isHovered) itemOpacity = 0.35

          return (
            <button
              key={lc}
              className={clsx(
                'maxmin-legend-item flex items-center gap-1 text-[13px] cursor-pointer rounded px-1 py-0.5 text-left transition-opacity',
                isSelected && 'maxmin-legend-item-selected font-semibold'
              )}
              style={{ opacity: itemOpacity }}
              onClick={() => toggleLoadCase(lc)}
              onMouseEnter={() => setHoveredLoadCase(lc)}
              onMouseLeave={() => setHoveredLoadCase(null)}
            >
              <span className="inline-block w-3 shrink-0" style={{ borderTop: `2px solid ${color}` }} />
              <span className="inline-block w-3 shrink-0" style={{ borderTop: `2px dashed ${color}` }} />
              <span className="text-text-secondary truncate">{lc}</span>
            </button>
          )
        })}
        <div className="maxmin-legend-static flex items-center gap-1 text-[13px] px-1 py-0.5 mt-1">
          <span className="inline-block w-3 shrink-0" style={{ borderTop: `3px solid ${AVERAGE_LINE_COLOR}` }} />
          <span className="inline-block w-3 shrink-0" style={{ borderTop: `3px dashed ${AVERAGE_LINE_COLOR}` }} />
          <span className="text-text-secondary">Avg</span>
        </div>
      </div>
    </div>
  )
})

DirectionPlot.displayName = 'DirectionPlot'

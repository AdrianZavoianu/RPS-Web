/**
 * MaxMin Results Display — shared component for Plots/Tables tabs.
 * Used by both the tree browser (ResultsView) and standalone MaxMinView.
 */

import clsx from 'clsx'
import { memo, useCallback, useMemo, useState } from 'react'
import type { MaxMinDataset } from '../../types'
import { LazyPlot } from '../charts/LazyPlot'
import { PROFILE_SERIES_COLORS } from '../../utils/chartColors'
import { getGradientColor, getMinMax } from '../../utils/gradients'
import { getResultTypeDecimals, getResultTypeUnit } from '../../utils/resultConfig'
import {
  ACCENT_ZERO_LINE_COLOR,
  AVERAGE_LINE_COLOR,
  TEXT_COLOR,
} from '../../utils/colors'
import {
  PLOTLY_CONFIG_NO_MODE_BAR,
  createAxisLayout,
  withPlotlyDefaults,
} from '../../utils/plotlyDefaults'

export interface MaxMinResultsDisplayProps {
  data: MaxMinDataset
  resultType: string
}

type TabId = 'plots' | 'tables'

const STORY_AXIS_TOP_PADDING = 0.2

export function MaxMinResultsDisplay({
  data,
  resultType,
}: MaxMinResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState<TabId>('plots')
  const directions = data.directions || ['X', 'Y']

  // Extract unique load cases from OrigMax_ column keys
  const loadCases = useMemo(() => {
    const lcSet = new Set<string>()
    if (data.rows.length > 0) {
      const row = data.rows[0]
      for (const key of Object.keys(row)) {
        const match = key.match(/^OrigMax_(.+)_[XY]$/)
        if (match) {
          lcSet.add(match[1])
        }
      }
    }
    return Array.from(lcSet).sort()
  }, [data.rows])

  const unit = useMemo(() => getResultTypeUnit(resultType), [resultType])
  const decimals = useMemo(() => getResultTypeDecimals(resultType), [resultType])

  const fmt = (v: number | null | undefined) => {
    if (v === null || v === undefined) return '-'
    return v.toFixed(decimals)
  }

  return (
    <div className="maxmin-display flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="maxmin-tabs flex gap-0">
        {(['plots', 'tables'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'maxmin-tab px-4 py-1.5 text-base capitalize transition-colors',
              activeTab === tab
                ? 'maxmin-tab-active text-accent-primary border-b-2 border-accent-primary font-medium'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'plots' ? (
        <PlotsTab
          data={data}
          directions={directions}
          loadCases={loadCases}
          resultType={resultType}
          unit={unit}
          decimals={decimals}
        />
      ) : (
        <TablesTab
          data={data}
          directions={directions}
          loadCases={loadCases}
          resultType={resultType}
          unit={unit}
          fmt={fmt}
        />
      )}
    </div>
  )
}

/* ─── Plots Tab ──────────────────────────────────────────────── */

interface PlotsTabProps {
  data: MaxMinDataset
  directions: string[]
  loadCases: string[]
  resultType: string
  unit: string
  decimals: number
}

function PlotsTab({
  data, directions, loadCases, resultType, unit, decimals,
}: PlotsTabProps) {
  return (
    <div className="maxmin-plots flex-1">
      <div className="flex gap-4 h-[calc(90vh-3rem)]">
        {directions.map((dir) => (
          <DirectionPlot
            key={dir}
            direction={dir}
            data={data}
            loadCases={loadCases}
            resultType={resultType}
            unit={unit}
            decimals={decimals}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Per-Direction Plot + Legend (independent selection) ─────── */

interface DirectionPlotProps {
  direction: string
  data: MaxMinDataset
  loadCases: string[]
  resultType: string
  unit: string
  decimals: number
}

interface DirectionTraceEntry {
  loadCase: string | null
  trace: Record<string, unknown>
}

const DirectionPlot = memo(function DirectionPlot({
  direction,
  data,
  loadCases,
  resultType,
  unit,
  decimals,
}: DirectionPlotProps) {
  const [selectedLoadCases, setSelectedLoadCases] = useState<Set<string>>(new Set())
  const [hoveredLoadCase, setHoveredLoadCase] = useState<string | null>(null)

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
          hovertemplate: `${lc} Max<br>%{y}: %{x:.${decimals}f}<extra></extra>`,
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
          hovertemplate: `${lc} Min<br>%{y}: %{customdata:.${decimals}f}<extra></extra>`,
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
          hovertemplate: `Avg Max<br>%{y}: %{x:.${decimals}f}<extra></extra>`,
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
          hovertemplate: `Avg Min<br>%{y}: %{customdata:.${decimals}f}<extra></extra>`,
          customdata: avgMinRaw.map((value) => -value),
        },
      })
    }

    return traces
  }, [data.rows, loadCases, direction, decimals, stories])

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
      title: { text: `${resultType} (${unit})`, font: { size: 14, color: TEXT_COLOR }, standoff: 8 },
      zerolinecolor: ACCENT_ZERO_LINE_COLOR,
      zerolinewidth: 2,
      zeroline: true,
      tickfont: { size: 10, color: TEXT_COLOR },
    }),
    yaxis: createAxisLayout({
      title: { text: 'Story', font: { size: 14, color: TEXT_COLOR }, standoff: 8 },
      tickfont: { size: 10, color: TEXT_COLOR },
      range: [
        0,
        (stories.length > 0 ? stories.length - 1 : 0) + STORY_AXIS_TOP_PADDING,
      ],
    }),
    margin: { l: 50, r: 5, t: 40, b: 40 },
    hovermode: 'closest' as const,
    title: {
      text: `${direction} Direction`,
      font: { size: 14, color: TEXT_COLOR },
      x: 0.5,
      y: 0.98,
    },
  }), [resultType, unit, stories.length, direction])

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

/* ─── Tables Tab ─────────────────────────────────────────────── */

interface TablesTabProps {
  data: MaxMinDataset
  directions: string[]
  loadCases: string[]
  resultType: string
  unit: string
  fmt: (v: number | null | undefined) => string
}

function TablesTab({ data, directions, loadCases, resultType, unit, fmt }: TablesTabProps) {
  return (
    <div className="maxmin-tables-tab flex flex-col gap-6 flex-1 overflow-auto pt-4">
      {directions.map((dir) => (
        <DirectionTables
          key={dir}
          direction={dir}
          data={data}
          loadCases={loadCases}
          resultType={resultType}
          unit={unit}
          fmt={fmt}
        />
      ))}
    </div>
  )
}

interface DirectionTablesProps {
  direction: string
  data: MaxMinDataset
  loadCases: string[]
  resultType: string
  unit: string
  fmt: (v: number | null | undefined) => string
}

const DirectionTables = memo(function DirectionTables({
  direction,
  data,
  loadCases,
  resultType,
  unit,
  fmt,
}: DirectionTablesProps) {
  // Build max/min table data
  const { maxRows, minRows, maxRange, minRange } = useMemo(() => {
    const maxR: Array<Record<string, number | string | null>> = []
    const minR: Array<Record<string, number | string | null>> = []
    const allMaxVals: number[] = []
    const allMinVals: number[] = []

    for (const row of data.rows) {
      const mxRow: Record<string, number | string | null> = { Story: String(row['Story']) }
      const mnRow: Record<string, number | string | null> = { Story: String(row['Story']) }

      const lcMaxVals: number[] = []
      const lcMinVals: number[] = []

      for (const lc of loadCases) {
        const maxVal = row[`OrigMax_${lc}_${direction}`] as number | undefined
        const minVal = row[`OrigMin_${lc}_${direction}`] as number | undefined
        mxRow[lc] = maxVal ?? null
        mnRow[lc] = minVal ?? null
        if (maxVal != null) { allMaxVals.push(maxVal); lcMaxVals.push(maxVal) }
        if (minVal != null) { allMinVals.push(minVal); lcMinVals.push(minVal) }
      }

      // Avg column
      mxRow['Avg'] = lcMaxVals.length ? lcMaxVals.reduce((a, b) => a + b, 0) / lcMaxVals.length : null
      mnRow['Avg'] = lcMinVals.length ? lcMinVals.reduce((a, b) => a + b, 0) / lcMinVals.length : null
      if (mxRow['Avg'] != null) allMaxVals.push(mxRow['Avg'] as number)
      if (mnRow['Avg'] != null) allMinVals.push(mnRow['Avg'] as number)

      maxR.push(mxRow)
      minR.push(mnRow)
    }

    return {
      maxRows: maxR,
      minRows: minR,
      maxRange: getMinMax(allMaxVals),
      minRange: getMinMax(allMinVals),
    }
  }, [data.rows, loadCases, direction])

  const columns = [...loadCases, 'Avg']

  return (
    <div className="maxmin-direction-tables">
      <h3 className="text-sm font-medium text-text-primary mb-2">{direction} Direction</h3>
      <div className="flex gap-4">
        {/* Max table */}
        <div className="flex-1 overflow-auto max-h-[45vh]">
          <div className="text-xs font-medium text-text-secondary mb-1">Max ({unit})</div>
          <CompactTable
            rows={maxRows}
            columns={columns}
            range={maxRange}
            resultType={resultType}
            fmt={fmt}
          />
        </div>
        {/* Min table */}
        <div className="flex-1 overflow-auto max-h-[45vh]">
          <div className="text-xs font-medium text-text-secondary mb-1">Min ({unit})</div>
          <CompactTable
            rows={minRows}
            columns={columns}
            range={minRange}
            resultType={resultType}
            fmt={fmt}
          />
        </div>
      </div>
    </div>
  )
})

DirectionTables.displayName = 'DirectionTables'

/* ─── Compact Gradient Table ─────────────────────────────────── */

interface CompactTableProps {
  rows: Array<Record<string, number | string | null>>
  columns: string[]
  range: { min: number; max: number }
  resultType: string
  fmt: (v: number | null | undefined) => string
}

const CompactTable = memo(function CompactTable({
  rows,
  columns,
  range,
  resultType,
  fmt,
}: CompactTableProps) {
  return (
    <table className="maxmin-compact-table results-table w-full">
      <thead className="sticky top-0 z-10">
        <tr>
          <th className="results-table-header results-table-header-story">Story</th>
          {columns.map((col) => (
            <th
              key={col}
              className="results-table-header"
              style={col === 'Avg' ? { color: AVERAGE_LINE_COLOR } : undefined}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className="results-table-row">
            <td className="results-table-cell results-table-cell-story">{String(row['Story'])}</td>
            {columns.map((col) => {
              const val = row[col] as number | null
              const isAvg = col === 'Avg'
              const textColor = val != null && range.min !== range.max
                ? getGradientColor(val, range.min, range.max, resultType)
                : undefined
              return (
                <td
                  key={col}
                  className="results-table-cell"
                  style={{
                    color: isAvg ? AVERAGE_LINE_COLOR : textColor,
                  }}
                >
                  <span className={isAvg ? 'results-table-summary' : 'results-table-value'}>
                    {fmt(val)}
                  </span>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
})

CompactTable.displayName = 'CompactTable'

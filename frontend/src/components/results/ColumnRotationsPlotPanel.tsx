import clsx from 'clsx'
import { useMemo, useState } from 'react'

import type { ColumnRotationsPlotData, HistogramBin } from '../../types'
import { LazyPlot } from '../charts/LazyPlot'
import { withPlotlyDefaults } from '../../utils/plotlyDefaults'

interface ColumnRotationsPlotPanelProps {
  data: ColumnRotationsPlotData
}

type TabId = 'scatter' | 'histogram'

function seededJitter(index: number, seed: number) {
  const raw = ((index + 1) * 9301 + seed * 49297) % 233280
  return (raw / 233280 - 0.5) * 0.6
}

function buildHistogramBins(values: number[], binsCount = 50): HistogramBin[] {
  if (!values.length) {
    return []
  }

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)

  if (maxValue === minValue) {
    return [
      {
        start: minValue - 0.5,
        end: maxValue + 0.5,
        center: minValue,
        count: values.length,
      },
    ]
  }

  const width = (maxValue - minValue) / binsCount
  const counts = new Array<number>(binsCount).fill(0)

  values.forEach((value) => {
    let index = Math.floor((value - minValue) / width)
    if (index >= binsCount) {
      index = binsCount - 1
    }
    counts[index] += 1
  })

  return counts.map((count, idx) => {
    const start = minValue + idx * width
    const end = start + width
    return {
      start,
      end,
      center: (start + end) / 2,
      count,
    }
  })
}

export function ColumnRotationsPlotPanel({ data }: ColumnRotationsPlotPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('scatter')
  const [directionFilter, setDirectionFilter] = useState<string>('All')

  const availableDirections = useMemo(() => {
    const directionSet = new Set<string>()
    data.directions.forEach((direction) => {
      const value = direction.trim()
      if (value) {
        directionSet.add(value)
      }
    })
    if (!directionSet.size) {
      data.max_points.forEach((point) => directionSet.add(point.direction))
      data.min_points.forEach((point) => directionSet.add(point.direction))
    }
    return Array.from(directionSet).sort((a, b) => a.localeCompare(b))
  }, [data.directions, data.max_points, data.min_points])

  const effectiveDirection = useMemo(() => {
    if (directionFilter === 'All') {
      return directionFilter
    }
    return availableDirections.includes(directionFilter) ? directionFilter : 'All'
  }, [availableDirections, directionFilter])

  const filteredMaxPoints = useMemo(() => {
    if (effectiveDirection === 'All') {
      return data.max_points
    }
    return data.max_points.filter((point) => point.direction === effectiveDirection)
  }, [data.max_points, effectiveDirection])

  const filteredMinPoints = useMemo(() => {
    if (effectiveDirection === 'All') {
      return data.min_points
    }
    return data.min_points.filter((point) => point.direction === effectiveDirection)
  }, [data.min_points, effectiveDirection])

  const maxPointsWithJitter = useMemo(
    () =>
      filteredMaxPoints.map((point, index) => ({
        ...point,
        jitter: seededJitter(index, 64),
      })),
    [filteredMaxPoints]
  )

  const minPointsWithJitter = useMemo(
    () =>
      filteredMinPoints.map((point, index) => ({
        ...point,
        jitter: seededJitter(index, 65),
      })),
    [filteredMinPoints]
  )

  const allPoints = useMemo(
    () => [...maxPointsWithJitter, ...minPointsWithJitter],
    [maxPointsWithJitter, minPointsWithJitter]
  )

  const xRange = useMemo(() => {
    if (!allPoints.length) {
      return undefined
    }
    const allX = allPoints.map((point) => point.rotation)
    const maxAbs = Math.max(Math.abs(Math.min(...allX)), Math.abs(Math.max(...allX)))
    const pad = maxAbs * 0.1
    return [-(maxAbs + pad), maxAbs + pad]
  }, [allPoints])

  const histogramBins = useMemo(() => {
    if (effectiveDirection === 'All' && data.histogram_bins.length) {
      return data.histogram_bins
    }
    return buildHistogramBins(allPoints.map((point) => point.rotation))
  }, [allPoints, data.histogram_bins, effectiveDirection])

  const scatterMaxTrace = useMemo(
    () => ({
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: 'Max',
      x: maxPointsWithJitter.map((point) => point.rotation),
      y: maxPointsWithJitter.map((point) => point.story_index + point.jitter),
      customdata: maxPointsWithJitter.map((point) => [
        point.element,
        point.load_case,
        point.story,
        point.direction,
      ]),
      marker: {
        color: '#f97316',
        size: 4,
        opacity: 0.7,
      },
      hovertemplate:
        '%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]} (%{customdata[3]}): %{x:.3f}<extra></extra>',
    }),
    [maxPointsWithJitter]
  )

  const scatterMinTrace = useMemo(
    () => ({
      type: 'scatter' as const,
      mode: 'markers' as const,
      name: 'Min',
      x: minPointsWithJitter.map((point) => point.rotation),
      y: minPointsWithJitter.map((point) => point.story_index + point.jitter),
      customdata: minPointsWithJitter.map((point) => [
        point.element,
        point.load_case,
        point.story,
        point.direction,
      ]),
      marker: {
        color: '#f97316',
        size: 4,
        opacity: 0.7,
      },
      hovertemplate:
        '%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]} (%{customdata[3]}): %{x:.3f}<extra></extra>',
    }),
    [minPointsWithJitter]
  )

  const histogramTrace = useMemo(
    () => ({
      type: 'bar' as const,
      x: histogramBins.map((bin) => bin.center),
      y: histogramBins.map((bin) => bin.count),
      width: histogramBins.map((bin) => bin.end - bin.start),
      marker: {
        color: 'rgba(251, 146, 60, 0.7)',
        line: { color: '#fb923c', width: 1 },
      },
      hovertemplate: '%{x:.3f}<br>Count: %{y}<extra></extra>',
      name: 'Distribution',
      showlegend: false,
    }),
    [histogramBins]
  )

  if (!data.max_points.length && !data.min_points.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">No column rotation data available</div>
      </div>
    )
  }

  const directionButtons = ['All', ...availableDirections]
  const histogramMax = Math.max(1, ...histogramBins.map((bin) => bin.count))

  return (
    <div className="column-rotations-plot flex-1 flex flex-col overflow-hidden">
      <div className="column-rotations-toolbar flex items-center justify-between gap-3">
        <div className="column-rotations-tabs flex gap-0">
          {(['scatter', 'histogram'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'column-rotations-tab px-4 py-1.5 text-base capitalize transition-colors',
                activeTab === tab
                  ? 'text-accent-primary border-b-2 border-accent-primary font-medium'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="column-rotations-directions flex items-center gap-2">
          {directionButtons.map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => setDirectionFilter(direction)}
              className={clsx(
                'px-3 py-1 rounded text-sm transition-colors',
                effectiveDirection === direction
                  ? 'bg-accent-primary text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
              )}
            >
              {direction}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[calc(90vh-3rem)] min-h-0 mt-2">
        {!allPoints.length ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-text-muted">No {effectiveDirection} direction data available</div>
          </div>
        ) : activeTab === 'scatter' ? (
          <LazyPlot
            data={[scatterMaxTrace, scatterMinTrace]}
            layout={withPlotlyDefaults({
              xaxis: {
                title: { text: data.meta.x_label, font: { size: 13 } },
                zeroline: false,
                range: xRange,
                dtick: 0.5,
              },
              yaxis: {
                title: { text: 'Story', font: { size: 13 } },
                tickmode: 'array',
                tickvals: data.stories.map((_, index) => index),
                ticktext: data.stories,
                range: [-0.5, Math.max(data.stories.length - 0.5, 0.5)],
                zeroline: false,
              },
              shapes: [
                {
                  type: 'line',
                  x0: 0,
                  x1: 0,
                  y0: -0.5,
                  y1: Math.max(data.stories.length - 0.5, 0.5),
                  line: { color: '#4a7d89', width: 1, dash: 'dash' },
                },
              ],
              margin: { l: 72, r: 16, t: 6, b: 44 },
              legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: 1.02 },
              autosize: true,
            })}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        ) : (
          <LazyPlot
            data={[histogramTrace]}
            layout={withPlotlyDefaults({
              xaxis: {
                title: { text: data.meta.x_label, font: { size: 13 } },
                dtick: 0.5,
              },
              yaxis: {
                title: { text: 'Count', font: { size: 13 } },
                rangemode: 'tozero',
              },
              shapes: [
                {
                  type: 'line',
                  x0: 0,
                  x1: 0,
                  y0: 0,
                  y1: histogramMax,
                  line: { color: '#4a7d89', width: 1, dash: 'dash' },
                },
              ],
              margin: { l: 72, r: 16, t: 6, b: 44 },
              showlegend: false,
              autosize: true,
            })}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        )}
      </div>
    </div>
  )
}

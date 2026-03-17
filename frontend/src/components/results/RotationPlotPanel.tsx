import clsx from 'clsx'
import { useMemo, useState } from 'react'

import type { HistogramBin } from '../../types'
import { seededJitter, buildHistogramBins } from '../../utils/visualization'
import { LazyPlot } from '../charts/LazyPlot'
import { withPlotlyDefaults } from '../../utils/plotlyDefaults'

interface RotationPoint {
  rotation: number
  story_index: number
  element: string
  load_case: string
  story: string
  direction?: string
}

interface RotationPlotPanelProps {
  maxPoints: RotationPoint[]
  minPoints: RotationPoint[]
  stories: string[]
  histogramBins: HistogramBin[]
  xLabel: string
  emptyMessage: string
  className?: string
  directions?: string[]
  showDirectionInHover?: boolean
  separateMaxMin?: boolean
  maxSeed?: number
  minSeed?: number
}

type TabId = 'scatter' | 'histogram'

export function RotationPlotPanel({
  maxPoints,
  minPoints,
  stories,
  histogramBins: backendBins,
  xLabel,
  emptyMessage,
  className,
  directions,
  showDirectionInHover = false,
  separateMaxMin = false,
  maxSeed = 42,
  minSeed = 43,
}: RotationPlotPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('scatter')
  const [directionFilter, setDirectionFilter] = useState<string>('All')

  const hasDirectionFilter = !!directions

  // Resolve available directions from prop
  const availableDirections = useMemo(() => {
    if (!directions) return []
    const directionSet = new Set<string>()
    directions.forEach((d) => {
      const value = d.trim()
      if (value) directionSet.add(value)
    })
    if (!directionSet.size) {
      maxPoints.forEach((p) => { if (p.direction) directionSet.add(p.direction) })
      minPoints.forEach((p) => { if (p.direction) directionSet.add(p.direction) })
    }
    return Array.from(directionSet).sort((a, b) => a.localeCompare(b))
  }, [directions, maxPoints, minPoints])

  const effectiveDirection = useMemo(() => {
    if (!hasDirectionFilter) return 'All'
    if (directionFilter === 'All') return 'All'
    return availableDirections.includes(directionFilter) ? directionFilter : 'All'
  }, [hasDirectionFilter, availableDirections, directionFilter])

  // Filter points by direction
  const filteredMaxPoints = useMemo(() => {
    if (effectiveDirection === 'All') return maxPoints
    return maxPoints.filter((p) => p.direction === effectiveDirection)
  }, [maxPoints, effectiveDirection])

  const filteredMinPoints = useMemo(() => {
    if (effectiveDirection === 'All') return minPoints
    return minPoints.filter((p) => p.direction === effectiveDirection)
  }, [minPoints, effectiveDirection])

  // Add jitter
  const maxWithJitter = useMemo(
    () => filteredMaxPoints.map((p, i) => ({ ...p, jitter: seededJitter(i, maxSeed) })),
    [filteredMaxPoints, maxSeed]
  )

  const minWithJitter = useMemo(
    () => filteredMinPoints.map((p, i) => ({ ...p, jitter: seededJitter(i, minSeed) })),
    [filteredMinPoints, minSeed]
  )

  const allPoints = useMemo(
    () => [...maxWithJitter, ...minWithJitter],
    [maxWithJitter, minWithJitter]
  )

  // Symmetric x-axis range centered at 0
  const xRange = useMemo(() => {
    if (!allPoints.length) return undefined
    const allX = allPoints.map((p) => p.rotation)
    const maxAbs = Math.max(Math.abs(Math.min(...allX)), Math.abs(Math.max(...allX)))
    const pad = maxAbs * 0.1
    return [-(maxAbs + pad), maxAbs + pad]
  }, [allPoints])

  // Build hover template
  const hoverTemplate = showDirectionInHover
    ? '%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]} (%{customdata[3]}): %{x:.3f}<extra></extra>'
    : '%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]}: %{x:.3f}<extra></extra>'

  // Build scatter traces
  const scatterTraces = useMemo(() => {
    const markerStyle = { color: '#f97316', size: 4, opacity: 0.7 }

    const makeCustomdata = (points: typeof allPoints) =>
      showDirectionInHover
        ? points.map((p) => [p.element, p.load_case, p.story, p.direction ?? ''])
        : points.map((p) => [p.element, p.load_case, p.story])

    if (separateMaxMin) {
      return [
        {
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: 'Max',
          x: maxWithJitter.map((p) => p.rotation),
          y: maxWithJitter.map((p) => p.story_index + p.jitter),
          customdata: makeCustomdata(maxWithJitter),
          marker: markerStyle,
          hovertemplate: hoverTemplate,
        },
        {
          type: 'scatter' as const,
          mode: 'markers' as const,
          name: 'Min',
          x: minWithJitter.map((p) => p.rotation),
          y: minWithJitter.map((p) => p.story_index + p.jitter),
          customdata: makeCustomdata(minWithJitter),
          marker: markerStyle,
          hovertemplate: hoverTemplate,
        },
      ]
    }

    // Combined single trace
    return [
      {
        type: 'scatter' as const,
        mode: 'markers' as const,
        x: allPoints.map((p) => p.rotation),
        y: allPoints.map((p) => p.story_index + p.jitter),
        customdata: makeCustomdata(allPoints),
        marker: markerStyle,
        hovertemplate: hoverTemplate,
        showlegend: false,
      },
    ]
  }, [allPoints, maxWithJitter, minWithJitter, separateMaxMin, showDirectionInHover, hoverTemplate])

  // Histogram bins: use backend when unfiltered, recompute when filtered
  const histogramBins = useMemo(() => {
    if (effectiveDirection === 'All' && backendBins.length) {
      return backendBins
    }
    return buildHistogramBins(allPoints.map((p) => p.rotation))
  }, [allPoints, backendBins, effectiveDirection])

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

  const histogramMax = Math.max(1, ...histogramBins.map((bin) => bin.count))

  // Empty state — no data at all
  if (!maxPoints.length && !minPoints.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">{emptyMessage}</div>
      </div>
    )
  }

  const yMax = Math.max(stories.length - 0.5, 0.5)
  const showLegend = separateMaxMin
  const directionButtons = hasDirectionFilter ? ['All', ...availableDirections] : []

  return (
    <div className={clsx(className, 'flex-1 flex flex-col overflow-hidden')}>
      {/* Toolbar: tabs + optional direction filter */}
      <div className={clsx(
        'rotation-plot-toolbar flex items-center gap-3',
        hasDirectionFilter && 'justify-between'
      )}>
        <div className="rotation-plot-tabs flex gap-0">
          {(['scatter', 'histogram'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'rotation-plot-tab px-4 py-1.5 text-base capitalize transition-colors',
                activeTab === tab
                  ? 'text-accent-primary border-b-2 border-accent-primary font-medium'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        {hasDirectionFilter && (
          <div className="rotation-plot-directions flex items-center gap-2">
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
        )}
      </div>

      <div className="h-[calc(90vh-3rem)] min-h-0 mt-2">
        {!allPoints.length ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-text-muted">No {effectiveDirection} direction data available</div>
          </div>
        ) : activeTab === 'scatter' ? (
          <LazyPlot
            data={scatterTraces}
            layout={withPlotlyDefaults({
              xaxis: {
                title: { text: xLabel, font: { size: 13 } },
                zeroline: false,
                range: xRange,
                dtick: 0.5,
              },
              yaxis: {
                title: { text: 'Story', font: { size: 13 } },
                tickmode: 'array',
                tickvals: stories.map((_, index) => index),
                ticktext: stories,
                range: [-0.5, yMax],
                ...(separateMaxMin ? { zeroline: false } : {}),
              },
              shapes: [
                {
                  type: 'line',
                  x0: 0,
                  x1: 0,
                  y0: -0.5,
                  y1: yMax,
                  line: { color: '#4a7d89', width: 1, dash: 'dash' },
                },
              ],
              margin: { l: 72, r: 16, t: 6, b: 44 },
              ...(showLegend
                ? { legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: 1.02 } }
                : { showlegend: false }),
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
                title: { text: xLabel, font: { size: 13 } },
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

import clsx from 'clsx'
import { useMemo, useState } from 'react'

import type { BeamRotationsPlotData } from '../../types'
import { LazyPlot } from '../charts/LazyPlot'
import { withPlotlyDefaults } from '../../utils/plotlyDefaults'

interface BeamRotationsPlotPanelProps {
  data: BeamRotationsPlotData
}

function seededJitter(index: number, seed: number) {
  const raw = ((index + 1) * 9301 + seed * 49297) % 233280
  return (raw / 233280 - 0.5) * 0.6
}

type TabId = 'scatter' | 'histogram'

export function BeamRotationsPlotPanel({ data }: BeamRotationsPlotPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('scatter')

  // Combine max and min into a single uniform trace (desktop: single orange, no differentiation)
  const allPoints = useMemo(() => {
    const combined = [
      ...data.max_points.map((p, i) => ({ ...p, jitter: seededJitter(i, 42) })),
      ...data.min_points.map((p, i) => ({ ...p, jitter: seededJitter(i, 43) })),
    ]
    return combined
  }, [data.max_points, data.min_points])

  const scatterTrace = useMemo(
    () => ({
      type: 'scatter' as const,
      mode: 'markers' as const,
      x: allPoints.map((p) => p.rotation),
      y: allPoints.map((p) => p.story_index + p.jitter),
      customdata: allPoints.map((p) => [p.element, p.load_case, p.story]),
      marker: {
        color: '#f97316',
        size: 4,
        opacity: 0.7,
      },
      hovertemplate:
        '%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]}: %{x:.3f}<extra></extra>',
      showlegend: false,
    }),
    [allPoints]
  )

  // Symmetric x-axis range centered at 0 (desktop: ±max_abs + 10% padding)
  const xRange = useMemo(() => {
    if (!allPoints.length) return undefined
    const allX = allPoints.map((p) => p.rotation)
    const maxAbs = Math.max(Math.abs(Math.min(...allX)), Math.abs(Math.max(...allX)))
    const pad = maxAbs * 0.1
    return [-(maxAbs + pad), maxAbs + pad]
  }, [allPoints])

  const histogramTrace = useMemo(
    () => ({
      type: 'bar' as const,
      x: data.histogram_bins.map((bin) => bin.center),
      y: data.histogram_bins.map((bin) => bin.count),
      width: data.histogram_bins.map((bin) => bin.end - bin.start),
      marker: {
        color: 'rgba(251, 146, 60, 0.7)',
        line: { color: '#fb923c', width: 1 },
      },
      hovertemplate: '%{x:.3f}<br>Count: %{y}<extra></extra>',
      name: 'Distribution',
      showlegend: false,
    }),
    [data.histogram_bins]
  )

  if (!data.max_points.length && !data.min_points.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">No beam rotation data available</div>
      </div>
    )
  }

  return (
    <div className="beam-rotations-plot flex-1 flex flex-col overflow-hidden">
      {/* Tab bar — matches MaxMinResultsDisplay style */}
      <div className="beam-rotations-tabs flex gap-0">
        {(['scatter', 'histogram'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'beam-rotations-tab px-4 py-1.5 text-base capitalize transition-colors',
              activeTab === tab
                ? 'text-accent-primary border-b-2 border-accent-primary font-medium'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="h-[calc(90vh-3rem)] min-h-0 mt-2">
        {activeTab === 'scatter' ? (
          <LazyPlot
            data={[scatterTrace]}
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
              showlegend: false,
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
                  y1: Math.max(...data.histogram_bins.map((bin) => bin.count), 1),
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

/**
 * Base acceleration plot sub-component for the time-series view.
 * Renders the lowest-story acceleration time history with a playhead marker.
 */

import { useMemo } from 'react'
import { LazyPlot } from '../../charts/LazyPlot'
import { useThemeStore } from '../../../stores/themeStore'
import { ACCEL_LINE_COLOR, getChartColors, MARKER_COLOR } from '../../../utils/colors'
import {
  PLOTLY_CONFIG_NO_MODE_BAR,
  createAxisLayout,
  withPlotlyDefaults,
} from '../../../utils/plotlyDefaults'

// --- Types ---

interface BaseAccelerationPlotProps {
  timeSteps: number[]
  values: number[]
  currentTime: number
  onPlotInit?: (graphDiv: HTMLElement) => void
}

// --- Component ---

export function BaseAccelerationPlot({
  timeSteps,
  values,
  currentTime,
  onPlotInit,
}: BaseAccelerationPlotProps) {
  const theme = useThemeStore((s) => s.theme)

  const traces = useMemo(
    () => [
      {
        type: 'scatter' as const,
        mode: 'lines' as const,
        x: timeSteps,
        y: values,
        line: { color: ACCEL_LINE_COLOR, width: 1 },
        showlegend: false,
        hoverinfo: 'x+y' as const,
      },
    ],
    [timeSteps, values]
  )

  const maxTime = timeSteps.length > 0 ? timeSteps[timeSteps.length - 1] : 1

  // Stable layout - only recomputes when data range or theme changes
  const baseLayout = useMemo(
    () =>
      withPlotlyDefaults({
        xaxis: createAxisLayout({
          title: { text: 'Time (s)', font: { size: 10, color: getChartColors().textColor } },
          showgrid: false,
          tickfont: { size: 9, color: getChartColors().textColor },
          range: [0, maxTime],
        }),
        yaxis: createAxisLayout({
          title: { text: 'Accel (g)', font: { size: 10, color: getChartColors().textColor } },
          showgrid: false,
          tickfont: { size: 9, color: getChartColors().textColor },
        }),
        margin: { l: 52, r: 6, t: 4, b: 28 },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxTime, theme]
  )

  // Only shapes change per frame - lightweight merge, no new axis objects
  const layout = useMemo(
    () => ({
      ...baseLayout,
      shapes: [
        {
          type: 'rect' as const,
          x0: 0,
          x1: currentTime,
          y0: 0,
          y1: 1,
          yref: 'paper' as const,
          fillcolor: 'rgba(74, 125, 137, 0.15)',
          line: { width: 0 },
        },
        {
          type: 'line' as const,
          x0: currentTime,
          x1: currentTime,
          y0: 0,
          y1: 1,
          yref: 'paper' as const,
          line: { color: MARKER_COLOR, width: 1.5 },
        },
      ],
    }),
    [baseLayout, currentTime]
  )

  return (
    <LazyPlot
      data={traces}
      layout={layout}
      config={PLOTLY_CONFIG_NO_MODE_BAR}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
      onInitialized={(_figure, graphDiv) => onPlotInit?.(graphDiv as HTMLElement)}
    />
  )
}

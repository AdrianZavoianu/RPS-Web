/**
 * Profile plot sub-component for the time-series view.
 * Renders a single horizontal profile chart (stories vs value)
 * with max/min envelope dashes and the current animated profile line.
 */

import { useMemo } from 'react'
import { LazyPlot } from '../../charts/LazyPlot'
import { useThemeStore } from '../../../stores/themeStore'
import {
  getChartColors,
  MAX_ENVELOPE_COLOR,
  MIN_ENVELOPE_COLOR,
  PROFILE_COLOR,
} from '../../../utils/colors'
import {
  PLOTLY_CONFIG_NO_MODE_BAR,
  createAxisLayout,
  withPlotlyDefaults,
} from '../../../utils/plotlyDefaults'
import { STORY_AXIS_TOP_PADDING, type EnvelopeData } from '../../../hooks/useTimeSeriesAnimation'

// --- Types ---

interface TimeSeriesProfilePlotProps {
  resultType: string
  unit: string
  stories: string[]
  profile: number[] | null
  envelope: EnvelopeData | undefined
  onPlotInit?: (graphDiv: HTMLElement) => void
}

// --- Component ---

export function TimeSeriesProfilePlot({
  resultType,
  unit,
  stories,
  profile,
  envelope,
  onPlotInit,
}: TimeSeriesProfilePlotProps) {
  const theme = useThemeStore((s) => s.theme)

  const traces = useMemo(() => {
    const t: Plotly.Data[] = []

    // Max envelope
    if (envelope) {
      t.push({
        type: 'scatter',
        mode: 'lines',
        x: envelope.maxValues,
        y: stories,
        orientation: 'h',
        line: { color: MAX_ENVELOPE_COLOR, width: 1, dash: 'dash' },
        name: 'Max',
        showlegend: false,
        hoverinfo: 'skip',
      } as Plotly.Data)
    }

    // Min envelope
    if (envelope) {
      t.push({
        type: 'scatter',
        mode: 'lines',
        x: envelope.minValues,
        y: stories,
        orientation: 'h',
        line: { color: MIN_ENVELOPE_COLOR, width: 1, dash: 'dash' },
        name: 'Min',
        showlegend: false,
        hoverinfo: 'skip',
      } as Plotly.Data)
    }

    // Current profile
    if (profile) {
      t.push({
        type: 'scatter',
        mode: 'lines+markers',
        x: profile,
        y: stories,
        orientation: 'h',
        line: { color: PROFILE_COLOR, width: 3 },
        marker: { color: PROFILE_COLOR, size: 5, symbol: 'circle' },
        name: resultType,
        showlegend: false,
      } as Plotly.Data)
    }

    return t
  }, [profile, envelope, stories, resultType])

  const layout = useMemo(
    () =>
      withPlotlyDefaults({
        xaxis: createAxisLayout({
          title: { text: `${unit}`, font: { size: 11, color: getChartColors().textColor } },
          showgrid: false,
          zerolinecolor: PROFILE_COLOR,
          zerolinewidth: 1,
          tickfont: { size: 10, color: getChartColors().textColor },
        }),
        yaxis: createAxisLayout({
          showgrid: false,
          tickfont: { size: 10, color: getChartColors().textColor },
          categoryorder: 'array' as const,
          categoryarray: stories,
          range: [0, (stories.length > 0 ? stories.length - 1 : 0) + STORY_AXIS_TOP_PADDING],
        }),
        margin: { l: 52, r: 6, t: 4, b: 32 },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stories, unit, theme]
  )

  return (
    <div className="ts-profile-plot flex-1 min-w-0 min-h-0 h-full overflow-hidden">
      <LazyPlot
        data={traces}
        layout={layout}
        config={PLOTLY_CONFIG_NO_MODE_BAR}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler
        onInitialized={(_figure, graphDiv) => onPlotInit?.(graphDiv as HTMLElement)}
      />
    </div>
  )
}

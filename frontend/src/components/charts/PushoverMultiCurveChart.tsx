import { LazyPlot } from './LazyPlot'
import {
  getChartColors,
  PUSHOVER_MULTI_PALETTE,
  ZERO_LINE_COLOR,
} from '../../utils/colors'
import {
  PLOTLY_CONFIG_NO_MODE_BAR,
  createAxisLayout,
  withPlotlyDefaults,
} from '../../utils/plotlyDefaults'
import { ChartLegend } from './ChartLegend'

export interface PushoverMultiCurveData {
  name: string
  points: { displacement: number; base_shear: number }[]
}

interface PushoverMultiCurveChartProps {
  curves: PushoverMultiCurveData[]
  height?: number
}

export function PushoverMultiCurveChart({
  curves,
}: PushoverMultiCurveChartProps) {
  const traces: Plotly.Data[] = curves.map((curve, idx) => ({
    type: 'scatter' as const,
    mode: 'lines' as const,
    name: curve.name,
    x: curve.points.map((p) => p.displacement),
    y: curve.points.map((p) => p.base_shear),
    line: {
      color: PUSHOVER_MULTI_PALETTE[idx % PUSHOVER_MULTI_PALETTE.length],
      width: 2,
    },
    hovertemplate: `${curve.name}<br>D: %{x:.2f} mm<br>V: %{y:.0f} kN<extra></extra>`,
  }))

  const legendItems = curves.map((curve, idx) => ({
    name: curve.name,
    color: PUSHOVER_MULTI_PALETTE[idx % PUSHOVER_MULTI_PALETTE.length],
  }))

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0">
        <LazyPlot
          data={traces}
          layout={withPlotlyDefaults({
            xaxis: createAxisLayout({
              title: { text: 'Displacement (mm)', font: { size: 14, color: getChartColors().textColor }, standoff: 8 },
              zerolinecolor: ZERO_LINE_COLOR,
              zerolinewidth: 1,
              rangemode: 'tozero',
            }),
            yaxis: createAxisLayout({
              title: { text: 'Base Shear (kN)', font: { size: 14, color: getChartColors().textColor }, standoff: 8 },
              zerolinecolor: ZERO_LINE_COLOR,
              zerolinewidth: 1,
              rangemode: 'tozero',
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

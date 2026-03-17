import { LazyPlot } from './LazyPlot'
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

interface PushoverCurveChartProps {
  points: { displacement: number; base_shear: number }[]
  caseName: string
  height?: number
}

export function PushoverCurveChart({
  points,
  caseName,
  height,
}: PushoverCurveChartProps) {
  const displacements = points.map((p) => p.displacement)
  const shears = points.map((p) => p.base_shear)

  return (
    <LazyPlot
      data={[
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: caseName,
          x: displacements,
          y: shears,
          line: {
            color: PROFILE_COLOR,
            width: 2,
          },
          marker: {
            color: PROFILE_COLOR,
            size: 6,
          },
          hovertemplate: `${caseName}<br>D: %{x:.2f} mm<br>V: %{y:.0f} kN<extra></extra>`,
        },
      ]}
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
      style={{ width: '100%', height: height || '100%' }}
      useResizeHandler
    />
  )
}

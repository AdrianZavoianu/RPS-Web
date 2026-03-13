import { getChartColors } from './colors'

export const PLOTLY_CONFIG_NO_MODE_BAR = {
  displayModeBar: false,
  responsive: true,
} as const

export function createAxisLayout(
  overrides: Partial<Plotly.LayoutAxis>
): Partial<Plotly.LayoutAxis> {
  const c = getChartColors()
  return {
    gridcolor: c.gridColor,
    gridwidth: 1,
    tickfont: { size: 10, color: c.textColor },
    linecolor: c.axisLineColor,
    linewidth: 1,
    mirror: true,
    ...overrides,
  }
}

export function withPlotlyDefaults(
  layout: Partial<Plotly.Layout>
): Partial<Plotly.Layout> {
  const c = getChartColors()
  const xaxis = layout.xaxis as Partial<Plotly.LayoutAxis> | undefined
  const yaxis = layout.yaxis as Partial<Plotly.LayoutAxis> | undefined
  const font = layout.font as Partial<Plotly.Font> | undefined

  return {
    ...layout,
    paper_bgcolor: layout.paper_bgcolor ?? c.paperBg,
    plot_bgcolor: layout.plot_bgcolor ?? c.plotBg,
    font: {
      color: c.textColor,
      size: 11,
      ...(font ?? {}),
    },
    showlegend: layout.showlegend ?? false,
    autosize: layout.autosize ?? true,
    xaxis: xaxis ? createAxisLayout(xaxis) : xaxis,
    yaxis: yaxis ? createAxisLayout(yaxis) : yaxis,
  }
}

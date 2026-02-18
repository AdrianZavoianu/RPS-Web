import {
  AXIS_LINE_COLOR,
  GRID_COLOR,
  PAPER_BG,
  PLOT_BG,
  TEXT_COLOR,
} from './colors'

const BASE_FONT: Partial<Plotly.Font> = {
  color: TEXT_COLOR,
  size: 11,
}

const BASE_AXIS: Partial<Plotly.LayoutAxis> = {
  gridcolor: GRID_COLOR,
  gridwidth: 1,
  tickfont: { size: 10, color: TEXT_COLOR },
  linecolor: AXIS_LINE_COLOR,
  linewidth: 1,
  mirror: true,
}

export const PLOTLY_CONFIG_NO_MODE_BAR = {
  displayModeBar: false,
  responsive: true,
} as const

export function createAxisLayout(
  overrides: Partial<Plotly.LayoutAxis>
): Partial<Plotly.LayoutAxis> {
  return {
    ...BASE_AXIS,
    ...overrides,
  }
}

export function withPlotlyDefaults(
  layout: Partial<Plotly.Layout>
): Partial<Plotly.Layout> {
  const xaxis = layout.xaxis as Partial<Plotly.LayoutAxis> | undefined
  const yaxis = layout.yaxis as Partial<Plotly.LayoutAxis> | undefined
  const font = layout.font as Partial<Plotly.Font> | undefined

  return {
    ...layout,
    paper_bgcolor: layout.paper_bgcolor ?? PAPER_BG,
    plot_bgcolor: layout.plot_bgcolor ?? PLOT_BG,
    font: {
      ...BASE_FONT,
      ...(font ?? {}),
    },
    showlegend: layout.showlegend ?? false,
    autosize: layout.autosize ?? true,
    xaxis: xaxis ? createAxisLayout(xaxis) : xaxis,
    yaxis: yaxis ? createAxisLayout(yaxis) : yaxis,
  }
}

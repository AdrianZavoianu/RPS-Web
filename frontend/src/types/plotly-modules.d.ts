declare module 'react-plotly.js/factory' {
  import type { ComponentType } from 'react'
  import type { PlotParams } from 'react-plotly.js'

  export default function createPlotlyComponent(plotly: unknown): ComponentType<PlotParams>
}

declare module 'plotly.js/lib/core' {
  const Plotly: {
    register: (modules: unknown[]) => void
  }
  export default Plotly
}

declare module 'plotly.js/lib/scatter' {
  const scatter: unknown
  export default scatter
}

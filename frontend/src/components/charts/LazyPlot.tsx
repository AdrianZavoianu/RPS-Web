import { Suspense, lazy } from 'react'
import type { PlotParams } from 'react-plotly.js'

const Plot = lazy(() => import('./PlotlyComponent'))

interface LazyPlotProps extends PlotParams {
  loadingMessage?: string
}

export function LazyPlot({ loadingMessage = 'Loading chart...', ...props }: LazyPlotProps) {
  return (
    <Suspense
      fallback={(
        <div className="chart-loading w-full h-full min-h-[220px] flex items-center justify-center text-sm text-text-secondary">
          {loadingMessage}
        </div>
      )}
    >
      <Plot {...props} />
    </Suspense>
  )
}

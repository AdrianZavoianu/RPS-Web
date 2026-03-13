import { Suspense, lazy, useMemo } from 'react'
import type { PlotParams } from 'react-plotly.js'
import { useThemeStore } from '../../stores/themeStore'
import { getChartColors } from '../../utils/colors'

const Plot = lazy(() => import('./PlotlyComponent'))

interface LazyPlotProps extends PlotParams {
  loadingMessage?: string
}

/**
 * Theme-aware Plotly wrapper.
 * Only patches lightweight top-level properties (bg colors, font color).
 * Axis theming is handled by parent components via createAxisLayout/withPlotlyDefaults
 * which read CSS vars at render time. Parents must include `theme` in their
 * layout useMemo deps to react to theme changes.
 */
export function LazyPlot({ loadingMessage = 'Loading chart...', layout, ...props }: LazyPlotProps) {
  const theme = useThemeStore((s) => s.theme)

  const themedLayout = useMemo(() => {
    const c = getChartColors()
    return {
      ...layout,
      paper_bgcolor: c.paperBg,
      plot_bgcolor: c.plotBg,
      font: {
        ...(layout?.font as Partial<Plotly.Font> | undefined),
        color: c.textColor,
      },
    } as Partial<Plotly.Layout>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, theme])

  return (
    <Suspense
      fallback={(
        <div className="chart-loading w-full h-full min-h-[220px] flex items-center justify-center text-sm text-text-secondary">
          {loadingMessage}
        </div>
      )}
    >
      <Plot layout={themedLayout} {...props} />
    </Suspense>
  )
}

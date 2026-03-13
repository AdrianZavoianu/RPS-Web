import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import * as resultsApi from '../../../../api/results'
import {
  buildBeamComparisonScatterTraces,
  buildStoryIndexMap,
  getLongestStories,
  mapNamedDatasets,
  mapResultSetNames,
  resolveBeamComparisonXRange,
} from '../../../../features/results/mappers/comparisonPanelMappers'
import { useResultSets } from '../../../../hooks/useResults'
import { queryKeys } from '../../../../hooks/queryKeys'
import { LazyPlot } from '../../../charts/LazyPlot'
import { withPlotlyDefaults } from '../../../../utils/plotlyDefaults'
import { getChartColors } from '../../../../utils/colors'

interface ComparisonBeamRotationsPanelProps {
  projectSlug: string
  resultSetIds: number[]
}

export function ComparisonBeamRotationsPanel({
  projectSlug,
  resultSetIds,
}: ComparisonBeamRotationsPanelProps) {
  const { data: resultSets } = useResultSets(projectSlug)
  const resultSetNames = useMemo(() => mapResultSetNames(resultSets), [resultSets])

  const plotQueries = useQueries({
    queries: resultSetIds.map((resultSetId) => ({
      queryKey: queryKeys.beamRotationsPlot(projectSlug, { result_set_id: resultSetId }),
      queryFn: () => resultsApi.getBeamRotationsPlotData(projectSlug, { result_set_id: resultSetId }),
      enabled: !!projectSlug && resultSetId > 0,
    })),
  })

  const isLoading = plotQueries.some((query) => query.isLoading || query.isFetching)

  const datasets = useMemo(
    () =>
      mapNamedDatasets(
        resultSetIds,
        plotQueries.map((query) => query.data),
        resultSetNames
      ),
    [plotQueries, resultSetIds, resultSetNames]
  )

  const stories = useMemo(() => getLongestStories(datasets), [datasets])

  const storyIndexMap = useMemo(() => buildStoryIndexMap(stories), [stories])

  const scatterTraces = useMemo(
    () => buildBeamComparisonScatterTraces(datasets, storyIndexMap),
    [datasets, storyIndexMap]
  )

  const xRange = useMemo(() => resolveBeamComparisonXRange(datasets), [datasets])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary">Loading beam rotation data...</div>
      </div>
    )
  }

  if (!datasets.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">No beam rotation data available</div>
      </div>
    )
  }

  const xLabel = datasets[0]?.data.meta.x_label || 'Rotation (%)'

  const chartColors = getChartColors()
  const plotLayout = {
    margin: { l: 72, r: 16, t: 6, b: 44 },
    autosize: true,
    showlegend: true,
    legend: {
      font: { size: 13, color: chartColors.textColor },
      bgcolor: chartColors.plotBgSolid,
      bordercolor: chartColors.gridColor,
      borderwidth: 1,
      x: 1,
      xanchor: 'right' as const,
      y: 1,
      yanchor: 'top' as const,
    },
  }

  return (
    <div className="beam-rotations-plot flex-1 flex flex-col overflow-hidden">
      <div className="h-[90vh] min-h-0">
        <LazyPlot
          data={scatterTraces}
          layout={withPlotlyDefaults({
            ...plotLayout,
            xaxis: {
              title: { text: xLabel, font: { size: 13 } },
              zeroline: false,
              range: xRange,
              dtick: 0.5,
            },
            yaxis: {
              title: { text: 'Story', font: { size: 13 } },
              tickmode: 'array' as const,
              tickvals: stories.map((_, index) => index),
              ticktext: stories,
              range: [-0.5, Math.max(stories.length - 0.5, 0.5)],
            },
            shapes: [{
              type: 'line' as const,
              x0: 0,
              x1: 0,
              y0: -0.5,
              y1: Math.max(stories.length - 0.5, 0.5),
              line: { color: '#4a7d89', width: 1, dash: 'dash' as const },
            }],
          })}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  )
}

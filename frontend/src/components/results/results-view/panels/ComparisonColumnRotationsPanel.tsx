import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import clsx from 'clsx'
import * as resultsApi from '../../../../api/results'
import {
  buildColumnComparisonScatterTraces,
  buildStoryIndexMap,
  collectColumnDirections,
  getLongestStories,
  mapNamedDatasets,
  mapResultSetNames,
  resolveColumnComparisonXRange,
} from '../../../../features/results/mappers/comparisonPanelMappers'
import { useResultSets } from '../../../../hooks/useResults'
import { queryKeys } from '../../../../hooks/queryKeys'
import { LazyPlot } from '../../../charts/LazyPlot'
import { withPlotlyDefaults } from '../../../../utils/plotlyDefaults'
import { getChartColors } from '../../../../utils/colors'

interface ComparisonColumnRotationsPanelProps {
  projectSlug: string
  resultSetIds: number[]
}

export function ComparisonColumnRotationsPanel({
  projectSlug,
  resultSetIds,
}: ComparisonColumnRotationsPanelProps) {
  const [directionFilter, setDirectionFilter] = useState<string>('All')

  const { data: resultSets } = useResultSets(projectSlug)
  const resultSetNames = useMemo(() => mapResultSetNames(resultSets), [resultSets])

  const plotQueries = useQueries({
    queries: resultSetIds.map((resultSetId) => ({
      queryKey: queryKeys.columnRotationsPlot(projectSlug, { result_set_id: resultSetId }),
      queryFn: () => resultsApi.getColumnRotationsPlotData(projectSlug, { result_set_id: resultSetId }),
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

  const availableDirections = useMemo(() => collectColumnDirections(datasets), [datasets])

  const effectiveDirection = useMemo(() => {
    if (directionFilter === 'All') return 'All'
    return availableDirections.includes(directionFilter) ? directionFilter : 'All'
  }, [availableDirections, directionFilter])

  const stories = useMemo(() => getLongestStories(datasets), [datasets])

  const storyIndexMap = useMemo(() => buildStoryIndexMap(stories), [stories])

  const scatterTraces = useMemo(
    () => buildColumnComparisonScatterTraces(datasets, effectiveDirection, storyIndexMap),
    [datasets, effectiveDirection, storyIndexMap]
  )

  const xRange = useMemo(
    () => resolveColumnComparisonXRange(datasets, effectiveDirection),
    [datasets, effectiveDirection]
  )

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary">Loading column rotation data...</div>
      </div>
    )
  }

  if (!datasets.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">No column rotation data available</div>
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

  const directionButtons = ['All', ...availableDirections]

  return (
    <div className="column-rotations-plot flex-1 flex flex-col overflow-hidden">
      <div className="column-rotations-toolbar flex items-center justify-between gap-3">
        <div className="column-rotations-directions flex items-center gap-2">
          {directionButtons.map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => setDirectionFilter(direction)}
              className={clsx(
                'px-3 py-1 rounded text-sm transition-colors',
                effectiveDirection === direction
                  ? 'bg-accent-primary text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-hover'
              )}
            >
              {direction}
            </button>
          ))}
        </div>
      </div>
      <div className="h-[calc(90vh-3rem)] min-h-0 mt-2">
        {effectiveDirection !== 'All' && !scatterTraces.some((trace) => trace.x.length > 0) ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-text-muted">No {effectiveDirection} direction data available</div>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}

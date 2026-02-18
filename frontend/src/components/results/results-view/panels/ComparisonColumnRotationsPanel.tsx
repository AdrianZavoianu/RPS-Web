import { useCallback, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import clsx from 'clsx'
import * as resultsApi from '../../../../api/results'
import { useResultSets } from '../../../../hooks/useResults'
import { queryKeys } from '../../../../hooks/queryKeys'
import type { ColumnRotationsPlotData } from '../../../../types'
import { ROTATION_COMPARISON_COLORS } from '../../../../utils/chartColors'
import { seededJitter } from '../../comparisonUtils'
import { LazyPlot } from '../../../charts/LazyPlot'

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
  const resultSetNames = useMemo(() => {
    const names: Record<number, string> = {}
    for (const resultSet of resultSets || []) names[resultSet.id] = resultSet.name
    return names
  }, [resultSets])

  const plotQueries = useQueries({
    queries: resultSetIds.map((resultSetId) => ({
      queryKey: queryKeys.columnRotationsPlot(projectSlug, { result_set_id: resultSetId }),
      queryFn: () => resultsApi.getColumnRotationsPlotData(projectSlug, { result_set_id: resultSetId }),
      enabled: !!projectSlug && resultSetId > 0,
    })),
  })

  const isLoading = plotQueries.some((query) => query.isLoading || query.isFetching)

  const datasets = useMemo(() => {
    const nextDatasets: Array<{ rsId: number; name: string; data: ColumnRotationsPlotData }> = []

    for (let index = 0; index < resultSetIds.length; index++) {
      const data = plotQueries[index].data
      const resultSetId = resultSetIds[index]
      if (!data || !resultSetId) continue

      nextDatasets.push({
        rsId: resultSetId,
        name: resultSetNames[resultSetId] || `RS ${resultSetId}`,
        data,
      })
    }

    return nextDatasets
  }, [plotQueries, resultSetIds, resultSetNames])

  const availableDirections = useMemo(() => {
    const directionSet = new Set<string>()

    datasets.forEach((dataset) => {
      dataset.data.directions.forEach((direction) => {
        const value = direction.trim()
        if (value) directionSet.add(value)
      })

      dataset.data.max_points.forEach((point) => {
        if (point.direction) directionSet.add(point.direction)
      })

      dataset.data.min_points.forEach((point) => {
        if (point.direction) directionSet.add(point.direction)
      })
    })

    return Array.from(directionSet).sort((a, b) => a.localeCompare(b))
  }, [datasets])

  const effectiveDirection = useMemo(() => {
    if (directionFilter === 'All') return 'All'
    return availableDirections.includes(directionFilter) ? directionFilter : 'All'
  }, [availableDirections, directionFilter])

  const stories = useMemo(() => {
    let longestStories: string[] = []

    for (const dataset of datasets) {
      if (dataset.data.stories.length > longestStories.length) longestStories = dataset.data.stories
    }

    return longestStories
  }, [datasets])

  const storyIndexMap = useMemo(() => {
    const nextMap: Record<string, number> = {}
    stories.forEach((story, storyIndex) => {
      nextMap[story] = storyIndex
    })
    return nextMap
  }, [stories])

  const getFilteredPoints = useCallback(
    (data: ColumnRotationsPlotData) => {
      const points = [...data.max_points, ...data.min_points]
      if (effectiveDirection === 'All') return points
      return points.filter((point) => point.direction === effectiveDirection)
    },
    [effectiveDirection]
  )

  const scatterTraces = useMemo(() => {
    return datasets.map((dataset, datasetIndex) => {
      const maxPoints =
        effectiveDirection === 'All'
          ? dataset.data.max_points
          : dataset.data.max_points.filter((point) => point.direction === effectiveDirection)

      const minPoints =
        effectiveDirection === 'All'
          ? dataset.data.min_points
          : dataset.data.min_points.filter((point) => point.direction === effectiveDirection)

      const points = [
        ...maxPoints.map((point, index) => ({ ...point, jitter: seededJitter(index, 74 + datasetIndex) })),
        ...minPoints.map((point, index) => ({ ...point, jitter: seededJitter(index, 75 + datasetIndex) })),
      ]

      const color = ROTATION_COMPARISON_COLORS[datasetIndex % ROTATION_COMPARISON_COLORS.length]

      return {
        type: 'scatter' as const,
        mode: 'markers' as const,
        name: dataset.name,
        x: points.map((point) => point.rotation),
        y: points.map((point) => (storyIndexMap[point.story] ?? point.story_index) + point.jitter),
        customdata: points.map((point) => [
          point.element,
          point.load_case,
          point.story,
          point.direction,
        ]),
        marker: { color, size: 4, opacity: 0.7 },
        hovertemplate: `<b>${dataset.name}</b><br>%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]} (%{customdata[3]}): %{x:.3f}<extra></extra>`,
        showlegend: true,
      }
    })
  }, [datasets, effectiveDirection, storyIndexMap])

  const xRange = useMemo(() => {
    const points = datasets.flatMap((dataset) => getFilteredPoints(dataset.data))
    if (!points.length) return undefined

    const maxAbsoluteValue = points.reduce(
      (maxValue, point) => Math.max(maxValue, Math.abs(point.rotation)),
      0
    )

    if (maxAbsoluteValue === 0) return undefined

    const padding = maxAbsoluteValue * 0.1
    return [-(maxAbsoluteValue + padding), maxAbsoluteValue + padding]
  }, [datasets, getFilteredPoints])

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

  const plotLayout = {
    paper_bgcolor: '#0a0c10',
    plot_bgcolor: 'rgba(22, 27, 34, 0.5)',
    font: { color: '#d1d5db', size: 11 },
    margin: { l: 72, r: 16, t: 6, b: 44 },
    autosize: true,
    legend: { font: { size: 11, color: '#d1d5db' }, bgcolor: 'rgba(0,0,0,0)' },
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
            layout={{
              ...plotLayout,
              xaxis: {
                title: { text: xLabel, font: { size: 13, color: '#d1d5db' } },
                gridcolor: 'rgba(60, 65, 75, 0.3)',
                zeroline: false,
                tickfont: { size: 10 },
                range: xRange,
                dtick: 0.5,
                linecolor: '#3a3f4a', linewidth: 1, mirror: true,
              },
              yaxis: {
                title: { text: 'Story', font: { size: 13, color: '#d1d5db' } },
                tickmode: 'array' as const,
                tickvals: stories.map((_, index) => index),
                ticktext: stories,
                range: [-0.5, Math.max(stories.length - 0.5, 0.5)],
                gridcolor: 'rgba(60, 65, 75, 0.25)',
                tickfont: { size: 10 },
                linecolor: '#3a3f4a', linewidth: 1, mirror: true,
              },
              shapes: [{
                type: 'line' as const,
                x0: 0,
                x1: 0,
                y0: -0.5,
                y1: Math.max(stories.length - 0.5, 0.5),
                line: { color: '#4a7d89', width: 1, dash: 'dash' as const },
              }],
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        )}
      </div>
    </div>
  )
}

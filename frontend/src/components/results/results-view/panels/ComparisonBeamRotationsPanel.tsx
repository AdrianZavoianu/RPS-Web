import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import * as resultsApi from '../../../../api/results'
import { useResultSets } from '../../../../hooks/useResults'
import { queryKeys } from '../../../../hooks/queryKeys'
import type { BeamRotationsPlotData } from '../../../../types'
import { ROTATION_COMPARISON_COLORS } from '../../../../utils/chartColors'
import { seededJitter } from '../../comparisonUtils'
import { LazyPlot } from '../../../charts/LazyPlot'

interface ComparisonBeamRotationsPanelProps {
  projectSlug: string
  resultSetIds: number[]
}

export function ComparisonBeamRotationsPanel({
  projectSlug,
  resultSetIds,
}: ComparisonBeamRotationsPanelProps) {
  const { data: resultSets } = useResultSets(projectSlug)
  const resultSetNames = useMemo(() => {
    const names: Record<number, string> = {}
    for (const resultSet of resultSets || []) names[resultSet.id] = resultSet.name
    return names
  }, [resultSets])

  const plotQueries = useQueries({
    queries: resultSetIds.map((resultSetId) => ({
      queryKey: queryKeys.beamRotationsPlot(projectSlug, { result_set_id: resultSetId }),
      queryFn: () => resultsApi.getBeamRotationsPlotData(projectSlug, { result_set_id: resultSetId }),
      enabled: !!projectSlug && resultSetId > 0,
    })),
  })

  const isLoading = plotQueries.some((query) => query.isLoading || query.isFetching)

  const datasets = useMemo(() => {
    const nextDatasets: Array<{ rsId: number; name: string; data: BeamRotationsPlotData }> = []
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

  const stories = useMemo(() => {
    let longestStories: string[] = []
    for (const dataset of datasets) {
      if (dataset.data.stories.length > longestStories.length) {
        longestStories = dataset.data.stories
      }
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

  const scatterTraces = useMemo(
    () => datasets.map((dataset, datasetIndex) => {
      const points = [
        ...dataset.data.max_points.map((point, index) => ({ ...point, jitter: seededJitter(index, 42 + datasetIndex) })),
        ...dataset.data.min_points.map((point, index) => ({ ...point, jitter: seededJitter(index, 43 + datasetIndex) })),
      ]

      const color = ROTATION_COMPARISON_COLORS[datasetIndex % ROTATION_COMPARISON_COLORS.length]

      return {
        type: 'scatter' as const,
        mode: 'markers' as const,
        name: dataset.name,
        x: points.map((point) => point.rotation),
        y: points.map((point) => (storyIndexMap[point.story] ?? point.story_index) + point.jitter),
        customdata: points.map((point) => [point.element, point.load_case, point.story]),
        marker: { color, size: 4, opacity: 0.7 },
        hovertemplate: `<b>${dataset.name}</b><br>%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]}: %{x:.3f}<extra></extra>`,
        showlegend: true,
      }
    }),
    [datasets, storyIndexMap]
  )

  const xRange = useMemo(() => {
    let maxAbsoluteValue = 0

    for (const dataset of datasets) {
      for (const point of [...dataset.data.max_points, ...dataset.data.min_points]) {
        const absoluteValue = Math.abs(point.rotation)
        if (absoluteValue > maxAbsoluteValue) maxAbsoluteValue = absoluteValue
      }
    }

    if (maxAbsoluteValue === 0) return undefined
    return [-(maxAbsoluteValue * 1.1), maxAbsoluteValue * 1.1]
  }, [datasets])

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

  const plotLayout = {
    paper_bgcolor: '#0a0c10',
    plot_bgcolor: 'rgba(22, 27, 34, 0.5)',
    font: { color: '#d1d5db', size: 11 },
    margin: { l: 72, r: 16, t: 6, b: 44 },
    autosize: true,
    legend: { font: { size: 11, color: '#d1d5db' }, bgcolor: 'rgba(0,0,0,0)' },
  }

  return (
    <div className="beam-rotations-plot flex-1 flex flex-col overflow-hidden">
      <div className="h-[90vh] min-h-0">
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
      </div>
    </div>
  )
}

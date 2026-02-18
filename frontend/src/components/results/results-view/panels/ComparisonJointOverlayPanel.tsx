import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import * as resultsApi from '../../../../api/results'
import { useResultSets } from '../../../../hooks/useResults'
import { queryKeys } from '../../../../hooks/queryKeys'
import type { ResultDataset } from '../../../../types'
import { ROTATION_COMPARISON_COLORS } from '../../../../utils/chartColors'
import { seededJitter } from '../../comparisonUtils'
import { LazyPlot } from '../../../charts/LazyPlot'

interface ComparisonJointOverlayPanelProps {
  projectSlug: string
  resultSetIds: number[]
  resultType: string
}

export function ComparisonJointOverlayPanel({
  projectSlug,
  resultSetIds,
  resultType,
}: ComparisonJointOverlayPanelProps) {
  const { data: resultSets } = useResultSets(projectSlug)
  const resultSetNames = useMemo(() => {
    const names: Record<number, string> = {}
    for (const resultSet of resultSets || []) names[resultSet.id] = resultSet.name
    return names
  }, [resultSets])

  const jointQueries = useQueries({
    queries: resultSetIds.map((resultSetId) => ({
      queryKey: queryKeys.jointResults(projectSlug, { result_set_id: resultSetId, result_type: resultType }),
      queryFn: () => resultsApi.getJointResults(projectSlug, { result_set_id: resultSetId, result_type: resultType }),
      enabled: !!projectSlug && resultSetId > 0 && !!resultType,
    })),
  })

  const isLoading = jointQueries.some((query) => query.isLoading || query.isFetching)

  const datasets = useMemo(() => {
    const nextDatasets: Array<{ rsId: number; name: string; data: ResultDataset }> = []

    for (let index = 0; index < resultSetIds.length; index++) {
      const data = jointQueries[index].data
      const resultSetId = resultSetIds[index]
      if (!data || !resultSetId) continue

      nextDatasets.push({
        rsId: resultSetId,
        name: resultSetNames[resultSetId] || `RS ${resultSetId}`,
        data,
      })
    }

    return nextDatasets
  }, [jointQueries, resultSetIds, resultSetNames])

  const useAbsoluteValue = resultType === 'SoilPressures' || resultType === 'VerticalDisplacements'

  const allLoadCases = useMemo(() => {
    const loadCaseSet = new Set<string>()

    for (const dataset of datasets) {
      for (const loadCase of dataset.data.load_case_columns) {
        loadCaseSet.add(loadCase)
      }
    }

    return [...loadCaseSet].sort()
  }, [datasets])

  const loadCaseIndexMap = useMemo(() => {
    const nextMap: Record<string, number> = {}
    allLoadCases.forEach((loadCase, loadCaseIndex) => {
      nextMap[loadCase] = loadCaseIndex
    })
    return nextMap
  }, [allLoadCases])

  const scatterTraces = useMemo(
    () => datasets.map((dataset, datasetIndex) => {
      const storyColumn = dataset.data.story_column || 'Shell Object'
      const xValues: number[] = []
      const yValues: number[] = []
      const customData: string[][] = []

      dataset.data.rows.forEach((row, rowIndex) => {
        const shellObject = String(row[storyColumn] ?? '')
        const uniqueName = String(row['Unique Name'] ?? '')

        dataset.data.load_case_columns.forEach((loadCase, loadCaseIndex) => {
          const rawValue = row[loadCase]
          if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) return

          const value = useAbsoluteValue ? Math.abs(rawValue) : rawValue
          xValues.push(
            (loadCaseIndexMap[loadCase] ?? loadCaseIndex) +
            seededJitter(rowIndex * 100 + loadCaseIndex, 42 + datasetIndex)
          )
          yValues.push(value)
          customData.push([loadCase, shellObject, uniqueName])
        })
      })

      const color = ROTATION_COMPARISON_COLORS[datasetIndex % ROTATION_COMPARISON_COLORS.length]

      return {
        type: 'scatter' as const,
        mode: 'markers' as const,
        name: dataset.name,
        x: xValues,
        y: yValues,
        customdata: customData,
        marker: { color, size: 4, opacity: 0.7 },
        hovertemplate: `<b>${dataset.name}</b><br>%{customdata[0]}<br>%{customdata[1]}<br>%{customdata[2]}: %{y:.3f}<extra></extra>`,
        showlegend: true,
      }
    }),
    [datasets, loadCaseIndexMap, useAbsoluteValue]
  )

  const yLabel =
    resultType === 'SoilPressures'
      ? `Soil Pressure (${datasets[0]?.data.meta?.unit || ''})`
      : resultType === 'VerticalDisplacements'
        ? `Vertical Displacement (${datasets[0]?.data.meta?.unit || ''})`
        : 'Value'

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-secondary">Loading joint data...</div>
      </div>
    )
  }

  if (!datasets.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted">No joint data available</div>
      </div>
    )
  }

  const plotLayout = {
    paper_bgcolor: '#0a0c10',
    plot_bgcolor: 'rgba(22, 27, 34, 0.5)',
    font: { color: '#d1d5db', size: 11 },
    margin: { l: 72, r: 16, t: 6, b: 44 },
    autosize: true,
    legend: { font: { size: 11, color: '#d1d5db' }, bgcolor: 'rgba(0,0,0,0)' },
  }

  const xRange = Math.max(allLoadCases.length - 0.5, 0.5)

  return (
    <div className="joint-results-plot flex-1 flex flex-col overflow-hidden">
      <div className="h-[90vh] min-h-0">
        <LazyPlot
          data={scatterTraces}
          layout={{
            ...plotLayout,
            xaxis: {
              title: { text: 'Load Case', font: { size: 13, color: '#d1d5db' } },
              tickmode: 'array' as const,
              tickvals: allLoadCases.map((_, index) => index),
              ticktext: allLoadCases,
              range: [-0.5, xRange],
              gridcolor: 'rgba(60, 65, 75, 0.25)',
              tickfont: { size: 10 },
              linecolor: '#3a3f4a', linewidth: 1, mirror: true,
            },
            yaxis: {
              title: { text: yLabel, font: { size: 13, color: '#d1d5db' } },
              gridcolor: 'rgba(60, 65, 75, 0.3)',
              zeroline: true,
              zerolinecolor: '#4a7d89',
              zerolinewidth: 1,
              tickfont: { size: 10 },
              linecolor: '#3a3f4a', linewidth: 1, mirror: true,
            },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  )
}

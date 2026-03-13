import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import * as resultsApi from '../../../../api/results'
import {
  buildJointComparisonScatterTraces,
  buildLoadCaseIndexMap,
  collectJointLoadCases,
  mapNamedDatasets,
  mapResultSetNames,
} from '../../../../features/results/mappers/comparisonPanelMappers'
import { useResultSets } from '../../../../hooks/useResults'
import { queryKeys } from '../../../../hooks/queryKeys'
import { LazyPlot } from '../../../charts/LazyPlot'
import { withPlotlyDefaults } from '../../../../utils/plotlyDefaults'
import { getChartColors } from '../../../../utils/colors'

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
  const resultSetNames = useMemo(() => mapResultSetNames(resultSets), [resultSets])

  const jointQueries = useQueries({
    queries: resultSetIds.map((resultSetId) => ({
      queryKey: queryKeys.jointResults(projectSlug, { result_set_id: resultSetId, result_type: resultType }),
      queryFn: () => resultsApi.getJointResults(projectSlug, { result_set_id: resultSetId, result_type: resultType }),
      enabled: !!projectSlug && resultSetId > 0 && !!resultType,
    })),
  })

  const isLoading = jointQueries.some((query) => query.isLoading || query.isFetching)

  const datasets = useMemo(
    () =>
      mapNamedDatasets(
        resultSetIds,
        jointQueries.map((query) => query.data),
        resultSetNames
      ),
    [jointQueries, resultSetIds, resultSetNames]
  )

  const useAbsoluteValue = resultType === 'SoilPressures' || resultType === 'VerticalDisplacements'

  const allLoadCases = useMemo(() => collectJointLoadCases(datasets), [datasets])

  const loadCaseIndexMap = useMemo(() => buildLoadCaseIndexMap(allLoadCases), [allLoadCases])

  const scatterTraces = useMemo(
    () => buildJointComparisonScatterTraces(datasets, loadCaseIndexMap, useAbsoluteValue),
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

  const xRange = Math.max(allLoadCases.length - 0.5, 0.5)

  return (
    <div className="joint-results-plot flex-1 flex flex-col overflow-hidden">
      <div className="h-[90vh] min-h-0">
        <LazyPlot
          data={scatterTraces}
          layout={withPlotlyDefaults({
            ...plotLayout,
            xaxis: {
              title: { text: 'Load Case', font: { size: 13 } },
              tickmode: 'array' as const,
              tickvals: allLoadCases.map((_, index) => index),
              ticktext: allLoadCases,
              range: [-0.5, xRange],
            },
            yaxis: {
              title: { text: yLabel, font: { size: 13 } },
              zeroline: true,
              zerolinecolor: '#4a7d89',
              zerolinewidth: 1,
            },
          })}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  )
}

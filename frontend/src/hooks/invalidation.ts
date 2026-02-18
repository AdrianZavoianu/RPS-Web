import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from './queryKeys'

export function invalidateByPrefix(
  queryClient: QueryClient,
  queryKey: readonly unknown[]
): void {
  queryClient.invalidateQueries({ queryKey, exact: false })
}

export function invalidateProjectResults(queryClient: QueryClient, projectSlug: string): void {
  const resultQueryPrefixes = [
    queryKeys.resultSets(projectSlug),
    queryKeys.availableResultTypes(projectSlug),
    queryKeys.globalResults(projectSlug),
    queryKeys.elementResults(projectSlug),
    queryKeys.elementsForType(projectSlug),
    queryKeys.jointResults(projectSlug),
    queryKeys.maxMinData(projectSlug),
    queryKeys.comparisonData(projectSlug),
    queryKeys.comparisonSets(projectSlug),
    queryKeys.chartData(projectSlug),
    queryKeys.beamRotationsPlot(projectSlug),
    queryKeys.beamRotationsTable(projectSlug),
    queryKeys.columnRotationsPlot(projectSlug),
    queryKeys.timeSeriesAllTypes(projectSlug),
    queryKeys.timeSeriesLoadCases(projectSlug),
    queryKeys.timeSeriesData(projectSlug),
    queryKeys.pushoverCases(projectSlug),
    queryKeys.pushoverCurve(projectSlug),
    queryKeys.pushoverCurvesBatch(projectSlug),
  ] as const

  for (const queryKey of resultQueryPrefixes) {
    invalidateByPrefix(queryClient, queryKey)
  }
}

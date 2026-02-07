/**
 * React Query hooks for results data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as resultsApi from '../api/results'
import type {
  GlobalResultsParams,
  ElementResultsParams,
  ElementListParams,
  JointResultsParams,
  MaxMinParams,
  ComparisonParams,
  ChartDataParams,
} from '../api/results'

// --- Result Sets ---

export function useResultSets(projectSlug: string) {
  return useQuery({
    queryKey: ['resultSets', projectSlug],
    queryFn: () => resultsApi.getResultSets(projectSlug),
    enabled: !!projectSlug,
  })
}

export function useResultSet(projectSlug: string, id: number) {
  return useQuery({
    queryKey: ['resultSet', projectSlug, id],
    queryFn: () => resultsApi.getResultSet(projectSlug, id),
    enabled: !!projectSlug && !!id,
  })
}

export function useDeleteResultSet(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => resultsApi.deleteResultSet(projectSlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resultSets', projectSlug] })
    },
  })
}

// --- Available Types ---

export function useAvailableResultTypes(projectSlug: string) {
  return useQuery({
    queryKey: ['availableResultTypes', projectSlug],
    queryFn: () => resultsApi.getAvailableResultTypes(projectSlug),
    enabled: !!projectSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// --- Global Results ---

export function useGlobalResults(
  projectSlug: string,
  params: GlobalResultsParams | null
) {
  return useQuery({
    queryKey: ['globalResults', projectSlug, params],
    queryFn: () => resultsApi.getGlobalResults(projectSlug, params!),
    enabled: !!projectSlug && !!params,
  })
}

// --- Element Results ---

export function useElementResults(
  projectSlug: string,
  params: ElementResultsParams | null
) {
  return useQuery({
    queryKey: ['elementResults', projectSlug, params],
    queryFn: () => resultsApi.getElementResults(projectSlug, params!),
    enabled: !!projectSlug && !!params,
  })
}

export function useElementsForType(
  projectSlug: string,
  params: ElementListParams | null
) {
  return useQuery({
    queryKey: ['elementsForType', projectSlug, params],
    queryFn: () => resultsApi.getElementsForType(projectSlug, params!),
    enabled: !!projectSlug && !!params,
  })
}

// --- Joint Results ---

export function useJointResults(
  projectSlug: string,
  params: JointResultsParams | null
) {
  return useQuery({
    queryKey: ['jointResults', projectSlug, params],
    queryFn: () => resultsApi.getJointResults(projectSlug, params!),
    enabled: !!projectSlug && !!params,
  })
}

// --- Max/Min Data ---

export function useMaxMinData(
  projectSlug: string,
  params: MaxMinParams | null
) {
  return useQuery({
    queryKey: ['maxMinData', projectSlug, params],
    queryFn: () => resultsApi.getMaxMinData(projectSlug, params!),
    enabled: !!projectSlug && !!params,
  })
}

// --- Comparison Data ---

export function useComparisonData(
  projectSlug: string,
  params: ComparisonParams | null
) {
  return useQuery({
    queryKey: ['comparisonData', projectSlug, params],
    queryFn: () => resultsApi.getComparisonData(projectSlug, params!),
    enabled: !!projectSlug && !!params && params.result_set_ids.length >= 2,
  })
}

// --- Chart Data ---

export function useChartData(
  projectSlug: string,
  params: ChartDataParams | null
) {
  return useQuery({
    queryKey: ['chartData', projectSlug, params],
    queryFn: () => resultsApi.getChartData(projectSlug, params!),
    enabled: !!projectSlug && !!params,
  })
}

// --- Pushover ---

export function usePushoverCases(projectSlug: string, resultSetId?: number) {
  return useQuery({
    queryKey: ['pushoverCases', projectSlug, resultSetId],
    queryFn: () => resultsApi.getPushoverCases(projectSlug, resultSetId),
    enabled: !!projectSlug,
  })
}

export function usePushoverCurve(projectSlug: string, caseId: number | null) {
  return useQuery({
    queryKey: ['pushoverCurve', projectSlug, caseId],
    queryFn: () => resultsApi.getPushoverCurve(projectSlug, caseId!),
    enabled: !!projectSlug && !!caseId,
  })
}

// --- Time-Series ---

export function useTimeSeriesLoadCases(projectSlug: string, resultSetId?: number) {
  return useQuery({
    queryKey: ['timeSeriesLoadCases', projectSlug, resultSetId],
    queryFn: () => resultsApi.getTimeSeriesLoadCases(projectSlug, resultSetId),
    enabled: !!projectSlug,
  })
}

export function useTimeSeriesData(
  projectSlug: string,
  params: resultsApi.TimeSeriesParams | null
) {
  return useQuery({
    queryKey: ['timeSeriesData', projectSlug, params],
    queryFn: () => resultsApi.getTimeSeriesData(projectSlug, params!),
    enabled: !!projectSlug && !!params,
    staleTime: 10 * 60 * 1000, // 10 minutes - time-series data is large, cache longer
  })
}

/**
 * Results API module
 */

import { apiClient } from './client'
import type {
  ResultSet,
  ResultDataset,
  MaxMinDataset,
  ComparisonDataset,
  ChartData,
  AvailableResultTypes,
  PushoverCase,
  PushoverCurve,
  Element,
} from '../types'

// --- Result Sets ---

export async function getResultSets(projectSlug: string): Promise<ResultSet[]> {
  return apiClient.get<ResultSet[]>(`/projects/${projectSlug}/result-sets/`)
}

export async function getResultSet(projectSlug: string, id: number): Promise<ResultSet> {
  return apiClient.get<ResultSet>(`/projects/${projectSlug}/result-sets/${id}/`)
}

export async function deleteResultSet(projectSlug: string, id: number): Promise<void> {
  return apiClient.delete(`/projects/${projectSlug}/result-sets/${id}/`)
}

// --- Available Types ---

export async function getAvailableResultTypes(projectSlug: string): Promise<AvailableResultTypes> {
  return apiClient.get<AvailableResultTypes>(`/projects/${projectSlug}/available-types/`)
}

// --- Global Results ---

export interface GlobalResultsParams {
  result_set_id: number
  result_type: string
  direction: string
  is_pushover?: boolean
}

export async function getGlobalResults(
  projectSlug: string,
  params: GlobalResultsParams
): Promise<ResultDataset> {
  const searchParams = new URLSearchParams({
    result_set_id: params.result_set_id.toString(),
    result_type: params.result_type,
    direction: params.direction,
  })
  if (params.is_pushover) {
    searchParams.set('is_pushover', 'true')
  }
  return apiClient.get<ResultDataset>(
    `/projects/${projectSlug}/results/global/?${searchParams.toString()}`
  )
}

// --- Element Results ---

export interface ElementResultsParams {
  result_set_id: number
  element_id: number
  result_type: string
  direction?: string
  is_pushover?: boolean
}

export async function getElementResults(
  projectSlug: string,
  params: ElementResultsParams
): Promise<ResultDataset> {
  const searchParams = new URLSearchParams({
    result_set_id: params.result_set_id.toString(),
    element_id: params.element_id.toString(),
    result_type: params.result_type,
  })
  if (params.direction) {
    searchParams.set('direction', params.direction)
  }
  if (params.is_pushover) {
    searchParams.set('is_pushover', 'true')
  }
  return apiClient.get<ResultDataset>(
    `/projects/${projectSlug}/results/element/?${searchParams.toString()}`
  )
}

export interface ElementListParams {
  result_set_id: number
  result_type: string
}

export async function getElementsForType(
  projectSlug: string,
  params: ElementListParams
): Promise<{ elements: Element[] }> {
  const searchParams = new URLSearchParams({
    result_set_id: params.result_set_id.toString(),
    result_type: params.result_type,
  })
  return apiClient.get<{ elements: Element[] }>(
    `/projects/${projectSlug}/results/elements/?${searchParams.toString()}`
  )
}

// --- Joint Results ---

export interface JointResultsParams {
  result_set_id: number
  result_type: string
  is_pushover?: boolean
}

export async function getJointResults(
  projectSlug: string,
  params: JointResultsParams
): Promise<ResultDataset> {
  const searchParams = new URLSearchParams({
    result_set_id: params.result_set_id.toString(),
    result_type: params.result_type,
  })
  if (params.is_pushover) {
    searchParams.set('is_pushover', 'true')
  }
  return apiClient.get<ResultDataset>(
    `/projects/${projectSlug}/results/joint/?${searchParams.toString()}`
  )
}

// --- Max/Min Data ---

export interface MaxMinParams {
  result_set_id: number
  result_type?: string
}

export async function getMaxMinData(
  projectSlug: string,
  params: MaxMinParams
): Promise<MaxMinDataset> {
  const searchParams = new URLSearchParams({
    result_set_id: params.result_set_id.toString(),
  })
  if (params.result_type) {
    searchParams.set('result_type', params.result_type)
  }
  return apiClient.get<MaxMinDataset>(
    `/projects/${projectSlug}/results/maxmin/?${searchParams.toString()}`
  )
}

// --- Comparison Data ---

export interface ComparisonParams {
  result_set_ids: number[]
  result_type: string
  direction?: string
  metric?: 'Avg' | 'Max' | 'Min'
  element_id?: number
}

export async function getComparisonData(
  projectSlug: string,
  params: ComparisonParams
): Promise<ComparisonDataset> {
  const searchParams = new URLSearchParams({
    result_set_ids: params.result_set_ids.join(','),
    result_type: params.result_type,
  })
  if (params.direction) {
    searchParams.set('direction', params.direction)
  }
  if (params.metric) {
    searchParams.set('metric', params.metric)
  }
  if (params.element_id) {
    searchParams.set('element_id', params.element_id.toString())
  }
  return apiClient.get<ComparisonDataset>(
    `/projects/${projectSlug}/results/comparison/?${searchParams.toString()}`
  )
}

// --- Chart Data ---

export interface ChartDataParams {
  result_set_id: number
  result_type: string
  direction: string
  column?: string
}

export async function getChartData(
  projectSlug: string,
  params: ChartDataParams
): Promise<ChartData> {
  const searchParams = new URLSearchParams({
    result_set_id: params.result_set_id.toString(),
    result_type: params.result_type,
    direction: params.direction,
  })
  if (params.column) {
    searchParams.set('column', params.column)
  }
  return apiClient.get<ChartData>(
    `/projects/${projectSlug}/results/chart/?${searchParams.toString()}`
  )
}

// --- Pushover ---

export async function getPushoverCases(
  projectSlug: string,
  resultSetId?: number
): Promise<{ pushover_cases: PushoverCase[] }> {
  const searchParams = new URLSearchParams()
  if (resultSetId) {
    searchParams.set('result_set_id', resultSetId.toString())
  }
  const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return apiClient.get<{ pushover_cases: PushoverCase[] }>(
    `/projects/${projectSlug}/pushover-cases/${query}`
  )
}

export async function getPushoverCurve(
  projectSlug: string,
  caseId: number
): Promise<PushoverCurve> {
  return apiClient.get<PushoverCurve>(
    `/projects/${projectSlug}/pushover-cases/${caseId}/curve/`
  )
}

// --- Time-Series ---

import type { TimeSeriesData } from '../types'

export interface TimeSeriesParams {
  result_set_id: number
  load_case: string
  result_type: string
  direction: string
}

export async function getTimeSeriesLoadCases(
  projectSlug: string,
  resultSetId?: number
): Promise<{ load_cases: string[] }> {
  const searchParams = new URLSearchParams()
  if (resultSetId) {
    searchParams.set('result_set_id', resultSetId.toString())
  }
  const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
  return apiClient.get<{ load_cases: string[] }>(
    `/projects/${projectSlug}/results/time-series/load-cases/${query}`
  )
}

export async function getTimeSeriesData(
  projectSlug: string,
  params: TimeSeriesParams
): Promise<TimeSeriesData> {
  const searchParams = new URLSearchParams({
    result_set_id: params.result_set_id.toString(),
    load_case: params.load_case,
    result_type: params.result_type,
    direction: params.direction,
  })
  return apiClient.get<TimeSeriesData>(
    `/projects/${projectSlug}/results/time-series/?${searchParams.toString()}`
  )
}

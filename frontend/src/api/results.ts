/**
 * Results API module
 */

import { apiClient, buildQueryParams } from './client'
import type {
  ResultSet,
  ResultDataset,
  MaxMinDataset,
  ComparisonDataset,
  ComparisonSet,
  ComparisonSetCreate,
  ChartData,
  BeamRotationsPlotData,
  BeamRotationsTableData,
  ColumnRotationsPlotData,
  AvailableResultTypes,
  ResultTreeMetadata,
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

export async function getResultTreeMetadata(
  projectSlug: string,
  resultSetId: number
): Promise<ResultTreeMetadata> {
  const query = buildQueryParams({
    result_set_id: resultSetId,
  })
  return apiClient.get<ResultTreeMetadata>(
    `/projects/${projectSlug}/results/tree-metadata/${query}`
  )
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
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
    result_type: params.result_type,
    direction: params.direction,
    is_pushover: params.is_pushover ? true : undefined,
  })
  return apiClient.get<ResultDataset>(
    `/projects/${projectSlug}/results/global/${query}`
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
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
    element_id: params.element_id,
    result_type: params.result_type,
    direction: params.direction,
    is_pushover: params.is_pushover ? true : undefined,
  })
  return apiClient.get<ResultDataset>(
    `/projects/${projectSlug}/results/element/${query}`
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
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
    result_type: params.result_type,
  })
  return apiClient.get<{ elements: Element[] }>(
    `/projects/${projectSlug}/results/elements/${query}`
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
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
    result_type: params.result_type,
    is_pushover: params.is_pushover ? true : undefined,
  })
  return apiClient.get<ResultDataset>(
    `/projects/${projectSlug}/results/joint/${query}`
  )
}

// --- Max/Min Data ---

export interface MaxMinParams {
  result_set_id: number
  result_type?: string
  element_id?: number
}

export async function getMaxMinData(
  projectSlug: string,
  params: MaxMinParams
): Promise<MaxMinDataset> {
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
    result_type: params.result_type,
    element_id: params.element_id,
  })
  return apiClient.get<MaxMinDataset>(
    `/projects/${projectSlug}/results/maxmin/${query}`
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
  const query = buildQueryParams({
    result_set_ids: params.result_set_ids,
    result_type: params.result_type,
    direction: params.direction,
    metric: params.metric,
    element_id: params.element_id,
  })
  return apiClient.get<ComparisonDataset>(
    `/projects/${projectSlug}/results/comparison/${query}`
  )
}

// --- Comparison Sets CRUD ---

export async function getComparisonSets(projectSlug: string): Promise<ComparisonSet[]> {
  return apiClient.get<ComparisonSet[]>(`/projects/${projectSlug}/comparison-sets/`)
}

export async function createComparisonSet(
  projectSlug: string,
  data: ComparisonSetCreate
): Promise<ComparisonSet> {
  return apiClient.post<ComparisonSet>(`/projects/${projectSlug}/comparison-sets/`, data)
}

export async function deleteComparisonSet(projectSlug: string, id: number): Promise<void> {
  return apiClient.delete(`/projects/${projectSlug}/comparison-sets/${id}/`)
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
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
    result_type: params.result_type,
    direction: params.direction,
    column: params.column,
  })
  return apiClient.get<ChartData>(
    `/projects/${projectSlug}/results/chart/${query}`
  )
}

// --- Beam Rotations ---

export interface BeamRotationsParams {
  result_set_id: number
}

export interface ColumnRotationsParams {
  result_set_id: number
}

export async function getBeamRotationsPlotData(
  projectSlug: string,
  params: BeamRotationsParams
): Promise<BeamRotationsPlotData> {
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
  })
  return apiClient.get<BeamRotationsPlotData>(
    `/projects/${projectSlug}/results/beam-rotations/plot/${query}`
  )
}

export async function getBeamRotationsTableData(
  projectSlug: string,
  params: BeamRotationsParams
): Promise<BeamRotationsTableData> {
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
  })
  return apiClient.get<BeamRotationsTableData>(
    `/projects/${projectSlug}/results/beam-rotations/table/${query}`
  )
}

export async function getColumnRotationsPlotData(
  projectSlug: string,
  params: ColumnRotationsParams
): Promise<ColumnRotationsPlotData> {
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
  })
  return apiClient.get<ColumnRotationsPlotData>(
    `/projects/${projectSlug}/results/column-rotations/plot/${query}`
  )
}

// --- Pushover ---

export async function getPushoverCases(
  projectSlug: string,
  resultSetId?: number
): Promise<{ pushover_cases: PushoverCase[] }> {
  const query = buildQueryParams({
    result_set_id: resultSetId,
  })
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

export interface PushoverCurvesBatchParams {
  result_set_id: number
  direction: string
}

export async function getPushoverCurvesBatch(
  projectSlug: string,
  params: PushoverCurvesBatchParams
): Promise<{ curves: PushoverCurve[] }> {
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
    direction: params.direction,
  })
  return apiClient.get<{ curves: PushoverCurve[] }>(
    `/projects/${projectSlug}/pushover-curves/batch/${query}`
  )
}

// --- Time-Series ---

import type { TimeSeriesData, TimeSeriesAllTypesData } from '../types'

export interface TimeSeriesAllTypesParams {
  result_set_id: number
  load_case: string
  direction: string
}

export async function getTimeSeriesAllTypes(
  projectSlug: string,
  params: TimeSeriesAllTypesParams
): Promise<TimeSeriesAllTypesData> {
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
    load_case: params.load_case,
    direction: params.direction,
  })
  return apiClient.get<TimeSeriesAllTypesData>(
    `/projects/${projectSlug}/results/time-series/all-types/${query}`
  )
}

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
  const query = buildQueryParams({
    result_set_id: resultSetId,
  })
  return apiClient.get<{ load_cases: string[] }>(
    `/projects/${projectSlug}/results/time-series/load-cases/${query}`
  )
}

export async function getTimeSeriesData(
  projectSlug: string,
  params: TimeSeriesParams
): Promise<TimeSeriesData> {
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
    load_case: params.load_case,
    result_type: params.result_type,
    direction: params.direction,
  })
  return apiClient.get<TimeSeriesData>(
    `/projects/${projectSlug}/results/time-series/${query}`
  )
}

/**
 * Chart Data, Beam/Column/Quad Rotations, Joint Results, MaxMin, and Time-Series endpoints
 */

import { apiClient, buildQueryParams } from '../client'
import type {
  ResultDataset,
  MaxMinDataset,
  ChartData,
  BeamRotationsPlotData,
  BeamRotationsTableData,
  ColumnRotationsPlotData,
  TimeSeriesData,
  TimeSeriesAllTypesData,
} from '../../types'

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

export interface QuadRotationsParams {
  result_set_id: number
}

export async function getQuadRotationsPlotData(
  projectSlug: string,
  params: QuadRotationsParams
): Promise<ColumnRotationsPlotData> {
  const query = buildQueryParams({
    result_set_id: params.result_set_id,
  })
  return apiClient.get<ColumnRotationsPlotData>(
    `/projects/${projectSlug}/results/quad-rotations/plot/${query}`
  )
}

// --- Time-Series ---

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

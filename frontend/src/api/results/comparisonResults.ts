/**
 * Comparison Data and Comparison Sets CRUD endpoints
 */

import { apiClient, buildQueryParams } from '../client'
import type { ComparisonDataset, ComparisonSet, ComparisonSetCreate } from '../../types'

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

/**
 * Result Sets, Available Types, and Tree Metadata endpoints
 */

import { apiClient, buildQueryParams } from '../client'
import type { ResultSet, AvailableResultTypes, ResultTreeMetadata } from '../../types'

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

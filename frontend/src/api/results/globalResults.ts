/**
 * Global Results endpoints
 */

import { apiClient, buildQueryParams } from '../client'
import type { ResultDataset } from '../../types'

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

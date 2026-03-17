/**
 * Element Results and Elements list endpoints
 */

import { apiClient, buildQueryParams } from '../client'
import type { ResultDataset, Element } from '../../types'

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

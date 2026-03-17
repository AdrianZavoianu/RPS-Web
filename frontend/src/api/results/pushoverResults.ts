/**
 * Pushover endpoints
 */

import { apiClient, buildQueryParams } from '../client'
import type { PushoverCase, PushoverCurve } from '../../types'

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

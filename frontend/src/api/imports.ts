/**
 * Import API module
 */

import { apiClient } from './client'
import type { ImportJob, PrescanResult, ImportStartRequest } from '../types'

// --- Import Jobs ---

export async function getImportJobs(projectSlug: string): Promise<ImportJob[]> {
  return apiClient.get<ImportJob[]>(`/projects/${projectSlug}/imports/`)
}

export async function getImportJob(projectSlug: string, jobId: number): Promise<ImportJob> {
  return apiClient.get<ImportJob>(`/projects/${projectSlug}/imports/${jobId}/`)
}

export async function cancelImportJob(projectSlug: string, jobId: number): Promise<void> {
  return apiClient.delete(`/projects/${projectSlug}/imports/${jobId}/`)
}

// --- Upload ---

export interface UploadResponse {
  job_id: number
  files_uploaded: number
  files: string[]
}

export async function uploadFiles(
  projectSlug: string,
  files: File[]
): Promise<UploadResponse> {
  const formData = new FormData()
  files.forEach((file) => {
    formData.append('files', file)
  })
  return apiClient.upload<UploadResponse>(
    `/projects/${projectSlug}/imports/upload/`,
    formData
  )
}

// --- Prescan ---

export interface PrescanTriggerResponse {
  detail: string
  task_id: string
  job_id: number
}

export async function triggerPrescan(
  projectSlug: string,
  jobId: number
): Promise<PrescanTriggerResponse> {
  return apiClient.post<PrescanTriggerResponse>(
    `/projects/${projectSlug}/imports/${jobId}/prescan/`
  )
}

export async function getPrescanResult(
  projectSlug: string,
  jobId: number
): Promise<PrescanResult> {
  return apiClient.get<PrescanResult>(
    `/projects/${projectSlug}/imports/${jobId}/prescan/`
  )
}

// --- Start Import ---

export interface StartImportResponse {
  detail: string
  task_id: string
  job_id: number
}

export async function startImport(
  projectSlug: string,
  jobId: number,
  options: ImportStartRequest
): Promise<StartImportResponse> {
  return apiClient.post<StartImportResponse>(
    `/projects/${projectSlug}/imports/${jobId}/start/`,
    options
  )
}

export async function startPushoverImport(
  projectSlug: string,
  jobId: number,
  options?: {
    resultSetName?: string
    resultSetId?: number
  }
): Promise<StartImportResponse> {
  const payload: Record<string, string | number> = {}
  if (options?.resultSetName) {
    payload.result_set_name = options.resultSetName
  }
  if (typeof options?.resultSetId === 'number') {
    payload.result_set_id = options.resultSetId
  }

  return apiClient.post<StartImportResponse>(
    `/projects/${projectSlug}/imports/${jobId}/start-pushover/`,
    payload
  )
}

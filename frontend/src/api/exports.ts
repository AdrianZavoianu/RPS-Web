/**
 * Export API module
 */

import { apiClient } from './client'

export interface ExportRequest {
  result_set_id: number
  result_types?: string[]
  element_types?: string[]
  joint_types?: string[]
  directions?: string[]
  format: 'excel' | 'csv'
  include_summary?: boolean
}

export interface ExportJob {
  id: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  file_name: string
  download_url: string | null
  error_message: string | null
  created_at: string
}

// Start export job
export async function startExport(
  projectSlug: string,
  request: ExportRequest
): Promise<ExportJob> {
  return apiClient.post<ExportJob>(`/projects/${projectSlug}/exports/`, request)
}

// Get export job status
export async function getExportJob(
  projectSlug: string,
  jobId: number
): Promise<ExportJob> {
  return apiClient.get<ExportJob>(`/projects/${projectSlug}/exports/${jobId}/`)
}

// List export jobs
export async function getExportJobs(projectSlug: string): Promise<ExportJob[]> {
  return apiClient.get<ExportJob[]>(`/projects/${projectSlug}/exports/`)
}

// Cancel export job
export async function cancelExportJob(
  projectSlug: string,
  jobId: number
): Promise<void> {
  return apiClient.delete(`/projects/${projectSlug}/exports/${jobId}/`)
}

// Download export file
export async function downloadExportFile(
  projectSlug: string,
  jobId: number
): Promise<Blob> {
  return apiClient.getBlob(`/projects/${projectSlug}/exports/${jobId}/download/`)
}

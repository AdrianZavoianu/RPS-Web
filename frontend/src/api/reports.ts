/**
 * Reports API module
 */

import { apiClient } from './client'

export interface ReportSection {
  result_type: string
  direction: string
  category?: string
  include_table?: boolean
  include_chart?: boolean
}

export interface AvailableSection {
  result_type: string
  direction: string
  category: string
  label: string
}

export interface ReportPreview {
  result_set: {
    id: number
    name: string
    analysis_type: string
  }
  available_sections: AvailableSection[]
}

export interface GenerateReportRequest {
  result_set_id: number
  sections: ReportSection[]
  project_name?: string
}

export interface ReportJob {
  id: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  file_name: string
  download_url: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface ReportJobRequest extends GenerateReportRequest {}

export async function getReportJobs(projectSlug: string): Promise<ReportJob[]> {
  return apiClient.get<ReportJob[]>(`/projects/${projectSlug}/reports/jobs/`)
}

export async function getReportJob(
  projectSlug: string,
  jobId: number
): Promise<ReportJob> {
  return apiClient.get<ReportJob>(`/projects/${projectSlug}/reports/jobs/${jobId}/`)
}

export async function startReportJob(
  projectSlug: string,
  request: ReportJobRequest
): Promise<ReportJob> {
  return apiClient.post<ReportJob>(`/projects/${projectSlug}/reports/jobs/`, request)
}

export async function cancelReportJob(
  projectSlug: string,
  jobId: number
): Promise<void> {
  return apiClient.delete(`/projects/${projectSlug}/reports/jobs/${jobId}/`)
}

export async function downloadReportFile(
  projectSlug: string,
  jobId: number
): Promise<Blob> {
  return apiClient.getBlob(`/projects/${projectSlug}/reports/jobs/${jobId}/download/`)
}

/**
 * Get available report sections for a result set
 */
export async function getReportPreview(
  projectSlug: string,
  resultSetId: number
): Promise<ReportPreview> {
  return apiClient.get<ReportPreview>(
    `/projects/${projectSlug}/reports/preview/?result_set_id=${resultSetId}`
  )
}

/**
 * Generate and download a PDF report
 * Returns the PDF as a Blob for download
 */
export async function generateReport(
  projectSlug: string,
  request: GenerateReportRequest
): Promise<Blob> {
  return apiClient.postBlob(`/projects/${projectSlug}/reports/generate/`, request)
}

// --- Section data types for live preview ---

export interface SectionTableRow {
  label_columns: string[]
  values: string[]
}

export interface SectionTableData {
  label_headers: string[]
  columns: string[]
  rows: SectionTableRow[]
}

export interface SectionData {
  title: string
  result_type: string
  direction: string | null
  category: string
  unit: string
  table: SectionTableData | null
  chart_svg: string | null
}

export interface SectionDataResponse {
  project_name: string
  result_set_name: string
  sections: SectionData[]
}

export interface SectionDataRequest {
  result_set_id: number
  sections: ReportSection[]
  project_name?: string
}

/**
 * Fetch structured section data for live A4 preview
 */
export async function getReportSectionData(
  projectSlug: string,
  request: SectionDataRequest
): Promise<SectionDataResponse> {
  return apiClient.post<SectionDataResponse>(
    `/projects/${projectSlug}/reports/sections/`,
    request
  )
}

/**
 * Helper to download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

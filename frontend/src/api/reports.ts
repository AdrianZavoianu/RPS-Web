/**
 * Reports API module
 */

import { apiClient } from './client'

export interface ReportSection {
  result_type: string
  direction: string
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

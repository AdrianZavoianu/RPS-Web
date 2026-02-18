/**
 * React Query hooks for PDF report generation
 */

import { useQuery, useMutation } from '@tanstack/react-query'
import * as reportsApi from '../api/reports'
import type { GenerateReportRequest, SectionDataRequest } from '../api/reports'
import { queryKeys } from './queryKeys'

/**
 * Fetch available report sections for a result set
 */
export function useReportPreview(projectSlug: string, resultSetId: number | null) {
  return useQuery({
    queryKey: queryKeys.reportPreview(projectSlug, resultSetId),
    queryFn: () => reportsApi.getReportPreview(projectSlug, resultSetId!),
    enabled: !!projectSlug && !!resultSetId,
  })
}

/**
 * Generate and download a PDF report
 */
export function useGenerateReport(projectSlug: string) {
  return useMutation({
    mutationFn: (request: GenerateReportRequest) =>
      reportsApi.generateReport(projectSlug, request),
    onSuccess: (blob, variables) => {
      // Auto-download the PDF
      const filename = `report_${variables.result_set_id}.pdf`
      reportsApi.downloadBlob(blob, filename)
    },
  })
}

/**
 * Fetch structured section data for live preview (mutation for imperative control)
 */
export function useReportSectionData(projectSlug: string) {
  return useMutation({
    mutationFn: (request: SectionDataRequest) =>
      reportsApi.getReportSectionData(projectSlug, request),
  })
}

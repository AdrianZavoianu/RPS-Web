/**
 * React Query hooks for PDF report generation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as reportsApi from '../api/reports'
import type {
  GenerateReportRequest,
  ReportJob,
  ReportJobRequest,
  SectionDataRequest,
} from '../api/reports'
import { useAuthStore } from '../stores/authStore'
import { invalidateByPrefix } from './invalidation'
import { useJobProgressTransport } from './useJobProgressTransport'
import { queryKeys } from './queryKeys'

type ReportProgressMessage = {
  type: 'progress'
  message?: string
  current?: number
  total?: number
  percent?: number
}

type ReportCompleteMessage = {
  type: 'complete'
  status?: string
  message?: string
}

type ReportErrorMessage = {
  type: 'error'
  message?: string
  details?: string
}

type ReportSocketMessage = ReportProgressMessage | ReportCompleteMessage | ReportErrorMessage

const ACTIVE_REPORT_STATUSES: ReportJob['status'][] = ['pending', 'processing']

function parseReportSocketMessage(raw: string): ReportSocketMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const payload = parsed as { type?: unknown }
    if (payload.type === 'progress' || payload.type === 'complete' || payload.type === 'error') {
      return parsed as ReportSocketMessage
    }
  } catch {
    return null
  }
  return null
}

function updateReportJobFromMessage(currentJob: ReportJob, message: ReportSocketMessage): ReportJob {
  if (message.type === 'progress') {
    return {
      ...currentJob,
      status: 'processing',
      progress: typeof message.percent === 'number' ? message.percent : currentJob.progress,
    }
  }

  if (message.type === 'complete') {
    return {
      ...currentJob,
      status: message.status === 'success' ? 'completed' : 'failed',
      progress: message.status === 'success' ? 100 : currentJob.progress,
    }
  }

  return {
    ...currentJob,
    status: 'failed',
    error_message: message.message || currentJob.error_message,
  }
}

function isReportTerminalMessage(message: ReportSocketMessage): boolean {
  return message.type === 'complete' || message.type === 'error'
}

export function useReportJobs(projectSlug: string) {
  return useQuery({
    queryKey: queryKeys.reportJobs(projectSlug),
    queryFn: () => reportsApi.getReportJobs(projectSlug),
    enabled: !!projectSlug,
  })
}

export function useReportJob(projectSlug: string, jobId: number | null) {
  const token = useAuthStore((state) => state.token)

  const socketConnected = useJobProgressTransport<ReportJob, ReportSocketMessage>({
    enabled: !!projectSlug && !!jobId,
    isTerminalMessage: isReportTerminalMessage,
    jobId,
    listQueryKey: queryKeys.reportJobs(projectSlug),
    parseMessage: parseReportSocketMessage,
    queryKey: queryKeys.reportJob(projectSlug, jobId),
    socketResource: 'reports',
    token,
    updateJobFromMessage: updateReportJobFromMessage,
  })

  return useQuery({
    queryKey: queryKeys.reportJob(projectSlug, jobId),
    queryFn: () => reportsApi.getReportJob(projectSlug, jobId!),
    enabled: !!projectSlug && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      if (socketConnected) return false
      if (ACTIVE_REPORT_STATUSES.includes(data.status)) {
        return 2000
      }
      return false
    },
  })
}

export function useStartReportJob(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: ReportJobRequest) => reportsApi.startReportJob(projectSlug, request),
    onSuccess: () => {
      invalidateByPrefix(queryClient, queryKeys.reportJobs(projectSlug))
    },
  })
}

export function useCancelReportJob(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobId: number) => reportsApi.cancelReportJob(projectSlug, jobId),
    onSuccess: () => {
      invalidateByPrefix(queryClient, queryKeys.reportJobs(projectSlug))
      invalidateByPrefix(queryClient, queryKeys.reportJob(projectSlug))
    },
  })
}

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

/**
 * React Query hooks for import operations
 */

import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as importsApi from '../api/imports'
import { useAuthStore } from '../stores/authStore'
import type { ImportJob, ImportStartRequest } from '../types'
import { queryKeys } from './queryKeys'
import { useWebSocketWithFallback } from './useWebSocket'
import { invalidateByPrefix } from './invalidation'

type ImportProgressMessage = {
  type: 'progress'
  phase?: string
  message?: string
  current?: number
  total?: number
  percent?: number
}

type ImportCompleteMessage = {
  type: 'complete'
  status?: string
  message?: string
  result_set_id?: number
}

type ImportErrorMessage = {
  type: 'error'
  message?: string
  details?: string
}

type ImportSocketMessage = ImportProgressMessage | ImportCompleteMessage | ImportErrorMessage

const ACTIVE_IMPORT_STATUSES: ImportJob['status'][] = ['pending', 'scanning', 'processing', 'building_cache']

function mapProgressPhaseToStatus(phase: string | undefined): ImportJob['status'] {
  if (phase === 'scanning') return 'scanning'
  if (phase === 'caching') return 'building_cache'
  return 'processing'
}

function parseImportSocketMessage(raw: string): ImportSocketMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const payload = parsed as { type?: unknown }
    if (payload.type === 'progress' || payload.type === 'complete' || payload.type === 'error') {
      return parsed as ImportSocketMessage
    }
  } catch {
    return null
  }
  return null
}

function toImportSummaryRecord(summary: ImportJob['import_summary']): Record<string, unknown> {
  if (summary && typeof summary === 'object') {
    return summary as Record<string, unknown>
  }
  return {}
}

// --- Import Jobs ---

export function useImportJobs(projectSlug: string) {
  return useQuery({
    queryKey: queryKeys.importJobs(projectSlug),
    queryFn: () => importsApi.getImportJobs(projectSlug),
    enabled: !!projectSlug,
  })
}

export function useImportJob(projectSlug: string, jobId: number | null) {
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.token)

  const socketUrl = useMemo(() => {
    if (!jobId || typeof window === 'undefined') {
      return null
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const baseUrl = `${protocol}//${window.location.host}/ws/imports/${jobId}/`
    return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl
  }, [jobId, token])

  const handleSocketMessage = useCallback(
    (message: ImportSocketMessage) => {
      queryClient.setQueryData<ImportJob | undefined>(
        queryKeys.importJob(projectSlug, jobId),
        (currentJob) => {
          if (!currentJob) {
            return currentJob
          }

          if (message.type === 'progress') {
            return {
              ...currentJob,
              status: mapProgressPhaseToStatus(message.phase),
              current_phase: message.message || currentJob.current_phase,
              progress_current:
                typeof message.current === 'number'
                  ? message.current
                  : currentJob.progress_current,
              progress_total:
                typeof message.total === 'number' ? message.total : currentJob.progress_total,
              progress_percent:
                typeof message.percent === 'number'
                  ? message.percent
                  : currentJob.progress_percent,
            }
          }

          if (message.type === 'complete') {
            const completionStatus = message.status ?? 'success'
            if (completionStatus === 'failed') {
              return {
                ...currentJob,
                status: 'failed',
                current_phase: message.message || currentJob.current_phase,
                error_message: message.message || currentJob.error_message,
              }
            }

            const importSummary = toImportSummaryRecord(currentJob.import_summary)
            const summaryWithWarnings =
              completionStatus === 'warning'
                ? {
                    ...importSummary,
                    has_warnings: true,
                    warning_count:
                      typeof importSummary.warning_count === 'number'
                        ? importSummary.warning_count
                        : 1,
                    errors:
                      Array.isArray(importSummary.errors) && importSummary.errors.length > 0
                        ? importSummary.errors
                        : message.message
                          ? [message.message]
                          : [],
                  }
                : importSummary

            return {
              ...currentJob,
              status: 'completed',
              current_phase: message.message || currentJob.current_phase,
              import_summary: summaryWithWarnings,
            }
          }

          return {
            ...currentJob,
            status: 'failed',
            current_phase: 'Import failed',
            error_message: message.message || currentJob.error_message,
          }
        }
      )

      if (message.type === 'complete' || message.type === 'error') {
        invalidateByPrefix(queryClient, queryKeys.importJob(projectSlug, jobId))
        invalidateByPrefix(queryClient, queryKeys.importJobs(projectSlug))
      }
    },
    [jobId, projectSlug, queryClient]
  )

  const socketConnected = useWebSocketWithFallback<ImportSocketMessage>(socketUrl, {
    enabled: !!projectSlug && !!jobId,
    parseMessage: parseImportSocketMessage,
    onMessage: handleSocketMessage,
  })

  return useQuery({
    queryKey: queryKeys.importJob(projectSlug, jobId),
    queryFn: () => importsApi.getImportJob(projectSlug, jobId!),
    enabled: !!projectSlug && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      if (socketConnected) return false
      // Poll while job is in progress when socket is unavailable
      if (ACTIVE_IMPORT_STATUSES.includes(data.status)) {
        return 2000 // Poll every 2 seconds
      }
      return false
    },
  })
}

export function useCancelImportJob(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobId: number) => importsApi.cancelImportJob(projectSlug, jobId),
    onSuccess: () => {
      invalidateByPrefix(queryClient, queryKeys.importJobs(projectSlug))
    },
  })
}

// --- Upload ---

export function useUploadFiles(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (files: File[]) => importsApi.uploadFiles(projectSlug, files),
    onSuccess: () => {
      invalidateByPrefix(queryClient, queryKeys.importJobs(projectSlug))
    },
  })
}

// --- Prescan ---

export function useTriggerPrescan(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobId: number) => importsApi.triggerPrescan(projectSlug, jobId),
    onSuccess: (_, jobId) => {
      invalidateByPrefix(queryClient, queryKeys.importJob(projectSlug, jobId))
    },
  })
}

export function usePrescanResult(projectSlug: string, jobId: number | null) {
  return useQuery({
    queryKey: queryKeys.prescanResult(projectSlug, jobId),
    queryFn: () => importsApi.getPrescanResult(projectSlug, jobId!),
    enabled: !!projectSlug && !!jobId,
    retry: (failureCount, error) => {
      // Retry a few times for 404 (prescan not yet complete)
      if ((error as Error)?.message?.includes('404')) {
        return failureCount < 10
      }
      return false
    },
    retryDelay: 1000,
  })
}

// --- Start Import ---

export function useStartImport(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, options }: { jobId: number; options: ImportStartRequest }) =>
      importsApi.startImport(projectSlug, jobId, options),
    onSuccess: (_, { jobId }) => {
      invalidateByPrefix(queryClient, queryKeys.importJob(projectSlug, jobId))
      invalidateByPrefix(queryClient, queryKeys.resultSets(projectSlug))
    },
  })
}

export function useStartPushoverImport(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      jobId,
      resultSetName,
      resultSetId,
    }: {
      jobId: number
      resultSetName?: string
      resultSetId?: number
    }) =>
      importsApi.startPushoverImport(projectSlug, jobId, {
        resultSetName,
        resultSetId,
      }),
    onSuccess: (_, { jobId }) => {
      invalidateByPrefix(queryClient, queryKeys.importJob(projectSlug, jobId))
      invalidateByPrefix(queryClient, queryKeys.resultSets(projectSlug))
      invalidateByPrefix(queryClient, queryKeys.pushoverCases(projectSlug))
    },
  })
}

export function useStartPushoverResultsImport(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      jobId,
      resultSetName,
      resultSetId,
    }: {
      jobId: number
      resultSetName?: string
      resultSetId?: number
    }) =>
      importsApi.startPushoverResultsImport(projectSlug, jobId, {
        resultSetName,
        resultSetId,
      }),
    onSuccess: (_, { jobId }) => {
      invalidateByPrefix(queryClient, queryKeys.importJob(projectSlug, jobId))
      invalidateByPrefix(queryClient, queryKeys.resultSets(projectSlug))
      invalidateByPrefix(queryClient, queryKeys.globalResults(projectSlug))
      invalidateByPrefix(queryClient, queryKeys.availableResultTypes(projectSlug))
    },
  })
}

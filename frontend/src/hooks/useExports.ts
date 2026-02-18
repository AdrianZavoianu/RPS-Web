/**
 * React Query hooks for export operations
 */

import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as exportsApi from '../api/exports'
import { useAuthStore } from '../stores/authStore'
import type { ExportJob, ExportRequest } from '../api/exports'
import { queryKeys } from './queryKeys'
import { useWebSocketWithFallback } from './useWebSocket'
import { invalidateByPrefix } from './invalidation'

type ExportProgressMessage = {
  type: 'progress'
  message?: string
  current?: number
  total?: number
  percent?: number
}

type ExportCompleteMessage = {
  type: 'complete'
  status?: string
  message?: string
}

type ExportErrorMessage = {
  type: 'error'
  message?: string
  details?: string
}

type ExportSocketMessage = ExportProgressMessage | ExportCompleteMessage | ExportErrorMessage

const ACTIVE_EXPORT_STATUSES: ExportJob['status'][] = ['pending', 'processing']

function parseExportSocketMessage(raw: string): ExportSocketMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const payload = parsed as { type?: unknown }
    if (payload.type === 'progress' || payload.type === 'complete' || payload.type === 'error') {
      return parsed as ExportSocketMessage
    }
  } catch {
    return null
  }
  return null
}

// Get export job status with polling
export function useExportJob(projectSlug: string, jobId: number | null) {
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.token)

  const socketUrl = useMemo(() => {
    if (!jobId || typeof window === 'undefined') {
      return null
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const baseUrl = `${protocol}//${window.location.host}/ws/exports/${jobId}/`
    return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl
  }, [jobId, token])

  const handleSocketMessage = useCallback(
    (message: ExportSocketMessage) => {
      queryClient.setQueryData<ExportJob | undefined>(
        queryKeys.exportJob(projectSlug, jobId),
        (currentJob) => {
          if (!currentJob) {
            return currentJob
          }

          if (message.type === 'progress') {
            return {
              ...currentJob,
              status: 'processing',
              progress:
                typeof message.percent === 'number' ? message.percent : currentJob.progress,
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
      )

      if (message.type === 'complete' || message.type === 'error') {
        invalidateByPrefix(queryClient, queryKeys.exportJob(projectSlug, jobId))
        invalidateByPrefix(queryClient, queryKeys.exportJobs(projectSlug))
      }
    },
    [jobId, projectSlug, queryClient]
  )

  const socketConnected = useWebSocketWithFallback<ExportSocketMessage>(socketUrl, {
    enabled: !!projectSlug && !!jobId,
    parseMessage: parseExportSocketMessage,
    onMessage: handleSocketMessage,
  })

  return useQuery({
    queryKey: queryKeys.exportJob(projectSlug, jobId),
    queryFn: () => exportsApi.getExportJob(projectSlug, jobId!),
    enabled: !!projectSlug && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      if (socketConnected) return false
      // Poll while job is in progress when socket is unavailable
      if (ACTIVE_EXPORT_STATUSES.includes(data.status)) {
        return 2000 // Poll every 2 seconds
      }
      return false
    },
  })
}

// List export jobs
export function useExportJobs(projectSlug: string) {
  return useQuery({
    queryKey: queryKeys.exportJobs(projectSlug),
    queryFn: () => exportsApi.getExportJobs(projectSlug),
    enabled: !!projectSlug,
  })
}

// Start export
export function useStartExport(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: ExportRequest) => exportsApi.startExport(projectSlug, request),
    onSuccess: () => {
      invalidateByPrefix(queryClient, queryKeys.exportJobs(projectSlug))
    },
  })
}

// Cancel export
export function useCancelExport(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobId: number) => exportsApi.cancelExportJob(projectSlug, jobId),
    onSuccess: () => {
      invalidateByPrefix(queryClient, queryKeys.exportJobs(projectSlug))
      invalidateByPrefix(queryClient, queryKeys.exportJob(projectSlug))
    },
  })
}

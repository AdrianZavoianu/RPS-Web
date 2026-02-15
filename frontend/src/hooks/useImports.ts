/**
 * React Query hooks for import operations
 */

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as importsApi from '../api/imports'
import type { ImportJob, ImportStartRequest } from '../types'

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
    queryKey: ['importJobs', projectSlug],
    queryFn: () => importsApi.getImportJobs(projectSlug),
    enabled: !!projectSlug,
  })
}

export function useImportJob(projectSlug: string, jobId: number | null) {
  const queryClient = useQueryClient()
  const [socketConnected, setSocketConnected] = useState(false)

  useEffect(() => {
    if (!projectSlug || !jobId || typeof window === 'undefined') {
      setSocketConnected(false)
      return
    }

    let socket: WebSocket | null = null
    let reconnectTimer: number | null = null
    let cancelled = false

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socketUrl = `${protocol}//${window.location.host}/ws/imports/${jobId}/`

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const scheduleReconnect = () => {
      if (cancelled) return
      clearReconnectTimer()
      reconnectTimer = window.setTimeout(connect, 1500)
    }

    const handleSocketMessage = (message: ImportSocketMessage) => {
      queryClient.setQueryData<ImportJob | undefined>(
        ['importJob', projectSlug, jobId],
        (currentJob) => {
          if (!currentJob) {
            return currentJob
          }

          if (message.type === 'progress') {
            return {
              ...currentJob,
              status: mapProgressPhaseToStatus(message.phase),
              current_phase: message.message || currentJob.current_phase,
              progress_current: typeof message.current === 'number' ? message.current : currentJob.progress_current,
              progress_total: typeof message.total === 'number' ? message.total : currentJob.progress_total,
              progress_percent:
                typeof message.percent === 'number' ? message.percent : currentJob.progress_percent,
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
        queryClient.invalidateQueries({ queryKey: ['importJob', projectSlug, jobId] })
        queryClient.invalidateQueries({ queryKey: ['importJobs', projectSlug] })
      }
    }

    const connect = () => {
      if (cancelled) return
      socket = new WebSocket(socketUrl)

      socket.onopen = () => {
        if (cancelled) return
        setSocketConnected(true)
      }

      socket.onmessage = (event) => {
        const message = parseImportSocketMessage(event.data)
        if (!message) return
        handleSocketMessage(message)
      }

      socket.onerror = () => {
        if (cancelled) return
        setSocketConnected(false)
      }

      socket.onclose = () => {
        if (cancelled) return
        setSocketConnected(false)
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      cancelled = true
      clearReconnectTimer()
      setSocketConnected(false)
      if (socket) {
        socket.close()
      }
    }
  }, [jobId, projectSlug, queryClient])

  return useQuery({
    queryKey: ['importJob', projectSlug, jobId],
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
      queryClient.invalidateQueries({ queryKey: ['importJobs', projectSlug] })
    },
  })
}

// --- Upload ---

export function useUploadFiles(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (files: File[]) => importsApi.uploadFiles(projectSlug, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['importJobs', projectSlug] })
    },
  })
}

// --- Prescan ---

export function useTriggerPrescan(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobId: number) => importsApi.triggerPrescan(projectSlug, jobId),
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['importJob', projectSlug, jobId] })
    },
  })
}

export function usePrescanResult(projectSlug: string, jobId: number | null) {
  return useQuery({
    queryKey: ['prescanResult', projectSlug, jobId],
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
      queryClient.invalidateQueries({ queryKey: ['importJob', projectSlug, jobId] })
      queryClient.invalidateQueries({ queryKey: ['resultSets', projectSlug] })
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
      queryClient.invalidateQueries({ queryKey: ['importJob', projectSlug, jobId] })
      queryClient.invalidateQueries({ queryKey: ['resultSets', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['pushoverCases', projectSlug] })
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
      queryClient.invalidateQueries({ queryKey: ['importJob', projectSlug, jobId] })
      queryClient.invalidateQueries({ queryKey: ['resultSets', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['globalResults', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['availableResultTypes', projectSlug] })
    },
  })
}

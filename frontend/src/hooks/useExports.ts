/**
 * React Query hooks for export operations
 */

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as exportsApi from '../api/exports'
import type { ExportJob, ExportRequest } from '../api/exports'

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
    const socketUrl = `${protocol}//${window.location.host}/ws/exports/${jobId}/`

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

    const handleSocketMessage = (message: ExportSocketMessage) => {
      queryClient.setQueryData<ExportJob | undefined>(
        ['exportJob', projectSlug, jobId],
        (currentJob) => {
          if (!currentJob) {
            return currentJob
          }

          if (message.type === 'progress') {
            return {
              ...currentJob,
              status: 'processing',
              progress:
                typeof message.percent === 'number'
                  ? message.percent
                  : currentJob.progress,
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
        queryClient.invalidateQueries({ queryKey: ['exportJob', projectSlug, jobId] })
        queryClient.invalidateQueries({ queryKey: ['exportJobs', projectSlug] })
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
        const message = parseExportSocketMessage(event.data)
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
    queryKey: ['exportJob', projectSlug, jobId],
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
    queryKey: ['exportJobs', projectSlug],
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
      queryClient.invalidateQueries({ queryKey: ['exportJobs', projectSlug] })
    },
  })
}

// Cancel export
export function useCancelExport(projectSlug: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobId: number) => exportsApi.cancelExportJob(projectSlug, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exportJobs', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['exportJob', projectSlug] })
    },
  })
}

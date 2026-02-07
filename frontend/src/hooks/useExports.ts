/**
 * React Query hooks for export operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as exportsApi from '../api/exports'
import type { ExportRequest } from '../api/exports'

// Get export job status with polling
export function useExportJob(projectSlug: string, jobId: number | null) {
  return useQuery({
    queryKey: ['exportJob', projectSlug, jobId],
    queryFn: () => exportsApi.getExportJob(projectSlug, jobId!),
    enabled: !!projectSlug && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      // Poll while job is in progress
      if (['pending', 'processing'].includes(data.status)) {
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

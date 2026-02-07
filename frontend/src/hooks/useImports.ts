/**
 * React Query hooks for import operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as importsApi from '../api/imports'
import type { ImportStartRequest } from '../types'

// --- Import Jobs ---

export function useImportJobs(projectSlug: string) {
  return useQuery({
    queryKey: ['importJobs', projectSlug],
    queryFn: () => importsApi.getImportJobs(projectSlug),
    enabled: !!projectSlug,
  })
}

export function useImportJob(projectSlug: string, jobId: number | null) {
  return useQuery({
    queryKey: ['importJob', projectSlug, jobId],
    queryFn: () => importsApi.getImportJob(projectSlug, jobId!),
    enabled: !!projectSlug && !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      // Poll while job is in progress
      if (['pending', 'scanning', 'processing', 'building_cache'].includes(data.status)) {
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
    mutationFn: ({ jobId, resultSetName }: { jobId: number; resultSetName?: string }) =>
      importsApi.startPushoverImport(projectSlug, jobId, resultSetName),
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['importJob', projectSlug, jobId] })
      queryClient.invalidateQueries({ queryKey: ['resultSets', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['pushoverCases', projectSlug] })
    },
  })
}

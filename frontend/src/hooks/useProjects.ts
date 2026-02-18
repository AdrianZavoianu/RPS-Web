import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { Project, ProjectCreate } from '../types'
import { queryKeys } from './queryKeys'
import { invalidateByPrefix } from './invalidation'

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects(),
    queryFn: () => apiClient.get<Project[]>('/projects/'),
  })
}

export function useProject(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(slug),
    queryFn: () => apiClient.get<Project>(`/projects/${slug}/`),
    enabled: !!slug,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ProjectCreate) => apiClient.post<Project>('/projects/', data),
    onSuccess: () => {
      invalidateByPrefix(queryClient, queryKeys.projects())
    },
  })
}

export function useUpdateProject(slug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<ProjectCreate>) =>
      apiClient.patch<Project>(`/projects/${slug}/`, data),
    onSuccess: () => {
      invalidateByPrefix(queryClient, queryKeys.projects())
      invalidateByPrefix(queryClient, queryKeys.project(slug))
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (slug: string) => apiClient.delete(`/projects/${slug}/`),
    onSuccess: () => {
      invalidateByPrefix(queryClient, queryKeys.projects())
    },
  })
}

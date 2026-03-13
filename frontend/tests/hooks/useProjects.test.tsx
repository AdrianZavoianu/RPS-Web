import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { http, HttpResponse } from 'msw'
import {
  useCreateProject,
  useDeleteProject,
  useProject,
  useProjects,
  useUpdateProject,
} from '../../src/hooks/useProjects'
import { server } from '../mocks/handlers'
import { makeProject } from '../mocks/factories'
import type { ProjectCreate } from '../../src/types'

vi.mock('../../src/stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: (state: { token: string }) => unknown) => selector({ token: 'test-token' }),
    { getState: () => ({ token: 'test-token', refreshToken: null, logout: vi.fn() }) }
  ),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}

describe('useProjects', () => {
  it('fetches all projects', async () => {
    const projects = [
      makeProject({ id: 1, slug: 'project-1', name: 'Project 1' }),
      makeProject({ id: 2, slug: 'project-2', name: 'Project 2' }),
    ]
    server.use(http.get('/api/projects/', () => HttpResponse.json(projects)))

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useProjects(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0].name).toBe('Project 1')
  })
})

describe('useProject', () => {
  it('fetches project detail when slug is provided', async () => {
    const project = makeProject({ slug: 'tower-a', name: 'Tower A' })
    server.use(http.get('/api/projects/:slug/', () => HttpResponse.json(project)))

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useProject('tower-a'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.slug).toBe('tower-a')
  })

  it('does not fetch when slug is undefined', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useProject(undefined), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCreateProject', () => {
  it('creates a project and invalidates projects query', async () => {
    let capturedBody: unknown = null
    const createdProject = makeProject({ id: 10, slug: 'new-project', name: 'New Project' })
    server.use(
      http.post('/api/projects/', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(createdProject, { status: 201 })
      })
    )

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useCreateProject(), { wrapper })

    const payload: ProjectCreate = {
      name: 'New Project',
      description: 'Created by tests',
      analysis_type: 'NLTHA',
    }

    await act(async () => {
      const created = await result.current.mutateAsync(payload)
      expect(created.id).toBe(10)
    })

    expect(capturedBody).toEqual(payload)
    expect(invalidateSpy).toHaveBeenCalled()
  })
})

describe('useUpdateProject', () => {
  it('updates a project and invalidates project list/detail queries', async () => {
    let capturedBody: unknown = null
    const updatedProject = makeProject({ slug: 'tower-a', name: 'Tower A v2' })
    server.use(
      http.patch('/api/projects/:slug/', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(updatedProject)
      })
    )

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateProject('tower-a'), { wrapper })

    const payload = { name: 'Tower A v2', description: 'Renamed tower' }
    await act(async () => {
      const updated = await result.current.mutateAsync(payload)
      expect(updated.name).toBe('Tower A v2')
    })

    expect(capturedBody).toEqual(payload)
    expect(invalidateSpy).toHaveBeenCalled()
  })
})

describe('useDeleteProject', () => {
  it('deletes a project and invalidates projects query', async () => {
    server.use(http.delete('/api/projects/:slug/', () => new HttpResponse(null, { status: 204 })))

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteProject(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('tower-a')
    })

    expect(invalidateSpy).toHaveBeenCalled()
  })
})

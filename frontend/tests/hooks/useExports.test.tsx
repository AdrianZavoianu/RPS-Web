import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useExportJob, useExportJobs, useStartExport, useCancelExport } from '../../src/hooks/useExports'
import { makeExportJob } from '../mocks/factories'
import { server } from '../mocks/handlers'
import { http, HttpResponse } from 'msw'

vi.mock('../../src/hooks/useWebSocket', () => ({
  useWebSocketWithFallback: vi.fn(() => false),
}))

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

describe('useExportJobs', () => {
  it('fetches export jobs for a project', async () => {
    const jobs = [makeExportJob({ id: 1 }), makeExportJob({ id: 2 })]
    server.use(
      http.get('/api/projects/:slug/exports/', () => HttpResponse.json(jobs))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useExportJobs('test-project'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('does not fetch when slug is empty', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useExportJobs(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useExportJob', () => {
  it('fetches a single export job', async () => {
    const job = makeExportJob({ id: 3, status: 'processing', progress: 50 })
    server.use(
      http.get('/api/projects/:slug/exports/:jobId/', () => HttpResponse.json(job))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useExportJob('test-project', 3), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe(3)
    expect(result.current.data?.progress).toBe(50)
  })

  it('does not fetch when jobId is null', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useExportJob('test-project', null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('reflects server-side processing with progress', async () => {
    const job = makeExportJob({ id: 1, status: 'processing', progress: 75 })
    server.use(
      http.get('/api/projects/:slug/exports/:jobId/', () => HttpResponse.json(job))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useExportJob('test-project', 1), { wrapper })

    await waitFor(() => expect(result.current.data?.progress).toBe(75))
    expect(result.current.data?.status).toBe('processing')
  })

  it('reflects server-side completed status', async () => {
    const job = makeExportJob({ id: 1, status: 'completed', progress: 100 })
    server.use(
      http.get('/api/projects/:slug/exports/:jobId/', () => HttpResponse.json(job))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useExportJob('test-project', 1), { wrapper })

    await waitFor(() => expect(result.current.data?.status).toBe('completed'))
    expect(result.current.data?.progress).toBe(100)
  })

  it('reflects server-side failed status', async () => {
    const job = makeExportJob({ id: 1, status: 'failed', error_message: 'Export failed' })
    server.use(
      http.get('/api/projects/:slug/exports/:jobId/', () => HttpResponse.json(job))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useExportJob('test-project', 1), { wrapper })

    await waitFor(() => expect(result.current.data?.status).toBe('failed'))
    expect(result.current.data?.error_message).toBe('Export failed')
  })
})

describe('useStartExport', () => {
  it('starts export and invalidates job list', async () => {
    const newJob = makeExportJob({ id: 5, status: 'pending' })
    server.use(
      http.post('/api/projects/:slug/exports/', () => HttpResponse.json(newJob))
    )

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useStartExport('test-project'), { wrapper })

    await act(async () => {
      const job = await result.current.mutateAsync({
        result_set_id: 1,
        format: 'excel',
      })
      expect(job.id).toBe(5)
    })

    expect(invalidateSpy).toHaveBeenCalled()
  })
})

describe('useCancelExport', () => {
  it('cancels export and invalidates queries', async () => {
    server.use(
      http.delete('/api/projects/:slug/exports/:jobId/', () =>
        new HttpResponse(null, { status: 204 })
      )
    )

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCancelExport('test-project'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(1)
    })

    expect(invalidateSpy).toHaveBeenCalled()
  })
})

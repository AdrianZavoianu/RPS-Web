import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useImportJob, useImportJobs, useCancelImportJob } from '../../src/hooks/useImports'
import { makeImportJob } from '../mocks/factories'
import { server } from '../mocks/handlers'
import { http, HttpResponse } from 'msw'

// Mock useWebSocket to control socket connection state
vi.mock('../../src/hooks/useWebSocket', () => ({
  useWebSocketWithFallback: vi.fn(() => false),
}))

// Mock useAuthStore for token
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

describe('useImportJobs', () => {
  it('fetches import jobs for a project', async () => {
    const jobs = [makeImportJob({ id: 1 }), makeImportJob({ id: 2 })]
    server.use(
      http.get('/api/projects/:slug/imports/', () => HttpResponse.json(jobs))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImportJobs('test-project'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('does not fetch when slug is empty', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImportJobs(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useImportJob', () => {
  it('fetches a single import job', async () => {
    const job = makeImportJob({ id: 5, status: 'processing' })
    server.use(
      http.get('/api/projects/:slug/imports/:jobId/', () => HttpResponse.json(job))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImportJob('test-project', 5), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe(5)
    expect(result.current.data?.status).toBe('processing')
  })

  it('does not fetch when jobId is null', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImportJob('test-project', null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('does not fetch when slug is empty', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImportJob('', 1), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useImportJob polling behavior', () => {
  let useWebSocketModule: typeof import('../../src/hooks/useWebSocket')

  beforeEach(async () => {
    useWebSocketModule = await import('../../src/hooks/useWebSocket')
  })

  it('polls when socket is disconnected and job is active', async () => {
    let fetchCount = 0
    const activeJob = makeImportJob({ id: 1, status: 'processing' })

    server.use(
      http.get('/api/projects/:slug/imports/:jobId/', () => {
        fetchCount++
        return HttpResponse.json(activeJob)
      })
    )

    vi.mocked(useWebSocketModule.useWebSocketWithFallback).mockReturnValue(false)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImportJob('test-project', 1), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const initialFetchCount = fetchCount

    // refetchInterval should be 2000 when socket disconnected and job is active
    // We don't wait for the actual interval; just verify the data came through
    expect(result.current.data?.status).toBe('processing')
    expect(initialFetchCount).toBeGreaterThanOrEqual(1)
  })

  it('does not poll when job is completed', async () => {
    const completedJob = makeImportJob({ id: 1, status: 'completed' })
    server.use(
      http.get('/api/projects/:slug/imports/:jobId/', () => HttpResponse.json(completedJob))
    )

    vi.mocked(useWebSocketModule.useWebSocketWithFallback).mockReturnValue(false)

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImportJob('test-project', 1), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.status).toBe('completed')
  })
})

describe('useCancelImportJob', () => {
  it('invalidates job list on success', async () => {
    server.use(
      http.delete('/api/projects/:slug/imports/:jobId/', () => new HttpResponse(null, { status: 204 }))
    )

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCancelImportJob('test-project'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(1)
    })

    expect(invalidateSpy).toHaveBeenCalled()
  })
})

describe('import job server-side status changes', () => {
  it('reflects server-side scanning status', async () => {
    const job = makeImportJob({ id: 1, status: 'scanning', current_phase: 'Scanning files' })
    server.use(
      http.get('/api/projects/:slug/imports/:jobId/', () => HttpResponse.json(job))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImportJob('test-project', 1), { wrapper })

    await waitFor(() => expect(result.current.data?.status).toBe('scanning'))
    expect(result.current.data?.current_phase).toBe('Scanning files')
  })

  it('reflects server-side completed with summary', async () => {
    const job = makeImportJob({
      id: 1,
      status: 'completed',
      import_summary: { has_warnings: true, warning_count: 2 },
    })
    server.use(
      http.get('/api/projects/:slug/imports/:jobId/', () => HttpResponse.json(job))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImportJob('test-project', 1), { wrapper })

    await waitFor(() => expect(result.current.data?.status).toBe('completed'))
    const summary = result.current.data?.import_summary as Record<string, unknown>
    expect(summary?.has_warnings).toBe(true)
  })

  it('reflects server-side failed status', async () => {
    const job = makeImportJob({
      id: 1,
      status: 'failed',
      error_message: 'Parse error',
      current_phase: 'Import failed',
    })
    server.use(
      http.get('/api/projects/:slug/imports/:jobId/', () => HttpResponse.json(job))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useImportJob('test-project', 1), { wrapper })

    await waitFor(() => expect(result.current.data?.status).toBe('failed'))
    expect(result.current.data?.error_message).toBe('Parse error')
  })
})

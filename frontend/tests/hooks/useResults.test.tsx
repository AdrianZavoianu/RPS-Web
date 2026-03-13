import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useResultSets,
  useGlobalResults,
  useElementResults,
  useComparisonData,
  useDeleteResultSet,
  useAvailableResultTypes,
  useChartData,
  usePushoverCases,
} from '../../src/hooks/useResults'
import { makeResultSet, makeResultDataset, makeAvailableResultTypes } from '../mocks/factories'
import { server } from '../mocks/handlers'
import { http, HttpResponse } from 'msw'

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

describe('useResultSets', () => {
  it('fetches result sets for a project', async () => {
    const sets = [makeResultSet({ id: 1 }), makeResultSet({ id: 2 })]
    server.use(
      http.get('/api/projects/:slug/result-sets/', () => HttpResponse.json(sets))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useResultSets('test-project'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })

  it('does not fetch when slug is empty', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useResultSets(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useGlobalResults', () => {
  it('fetches global results with params', async () => {
    const dataset = makeResultDataset()
    server.use(
      http.get('/api/projects/:slug/results/global/', () => HttpResponse.json(dataset))
    )

    const { wrapper } = createWrapper()
    const params = { result_set_id: 1, result_type: 'Drifts', direction: 'X' }
    const { result } = renderHook(() => useGlobalResults('test-project', params), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.rows).toHaveLength(3)
    expect(result.current.data?.load_case_columns).toContain('TH 01')
  })

  it('does not fetch when params are null', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useGlobalResults('test-project', null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useElementResults', () => {
  it('does not fetch when params are null', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useElementResults('test-project', null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches element results with params', async () => {
    const dataset = makeResultDataset({ meta: { result_type: 'WallShears', direction: 'V2', result_set_id: 1, display_name: 'Wall Shears V2' } })
    server.use(
      http.get('/api/projects/:slug/results/element/', () => HttpResponse.json(dataset))
    )

    const { wrapper } = createWrapper()
    const params = { result_set_id: 1, element_id: 5, result_type: 'WallShears', direction: 'V2' }
    const { result } = renderHook(() => useElementResults('test-project', params), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.meta?.result_type).toBe('WallShears')
  })
})

describe('useComparisonData', () => {
  it('does not fetch when params are null', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useComparisonData('test-project', null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('does not fetch when fewer than 2 result set IDs', () => {
    const { wrapper } = createWrapper()
    const params = { result_set_ids: [1], result_type: 'Drifts', direction: 'X' }
    const { result } = renderHook(() => useComparisonData('test-project', params), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches comparison data with 2+ result set IDs', async () => {
    const comparisonData = {
      result_type: 'Drifts',
      direction: 'X',
      metric: 'Avg',
      series: [
        { result_set_id: 1, result_set_name: 'Run 1', has_data: true, warning: null },
        { result_set_id: 2, result_set_name: 'Run 2', has_data: true, warning: null },
      ],
      rows: [{ Story: 'L1', 'Run 1': 0.15, 'Run 2': 0.18 }],
      ratio_column: null,
      warnings: [],
    }
    server.use(
      http.get('/api/projects/:slug/results/comparison/', () => HttpResponse.json(comparisonData))
    )

    const { wrapper } = createWrapper()
    const params = { result_set_ids: [1, 2], result_type: 'Drifts', direction: 'X' }
    const { result } = renderHook(() => useComparisonData('test-project', params), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.series).toHaveLength(2)
  })
})

describe('useDeleteResultSet', () => {
  it('invalidates result sets on success', async () => {
    server.use(
      http.delete('/api/projects/:slug/result-sets/:id/', () =>
        new HttpResponse(null, { status: 204 })
      )
    )

    const { wrapper, queryClient } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteResultSet('test-project'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(1)
    })

    expect(invalidateSpy).toHaveBeenCalled()
  })
})

describe('useAvailableResultTypes', () => {
  it('fetches available types', async () => {
    const types = makeAvailableResultTypes()
    server.use(
      http.get('/api/projects/:slug/available-types/', () => HttpResponse.json(types))
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useAvailableResultTypes('test-project'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.global_results).toHaveLength(4)
    expect(result.current.data?.has_pushover).toBe(false)
  })
})

describe('useChartData', () => {
  it('does not fetch when params are null', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useChartData('test-project', null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches chart data with params', async () => {
    const chartData = {
      stories: ['L3', 'L2', 'L1'],
      values: [0.15, 0.31, 0.12],
      result_type: 'Drifts',
      direction: 'X',
      column: 'TH 01',
      unit: '%',
    }
    server.use(
      http.get('/api/projects/:slug/results/chart/', () => HttpResponse.json(chartData))
    )

    const { wrapper } = createWrapper()
    const params = { result_set_id: 1, result_type: 'Drifts', direction: 'X', column: 'TH 01' }
    const { result } = renderHook(() => useChartData('test-project', params), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.stories).toHaveLength(3)
  })
})

describe('usePushoverCases', () => {
  it('does not fetch when resultSetId is undefined', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePushoverCases('test-project', undefined), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches pushover cases', async () => {
    server.use(
      http.get('/api/projects/:slug/pushover-cases/', () =>
        HttpResponse.json({
          pushover_cases: [
            { id: 1, name: 'Push X+', direction: 'X', result_set_id: 1 },
          ],
        })
      )
    )

    const { wrapper } = createWrapper()
    const { result } = renderHook(() => usePushoverCases('test-project', 1), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pushover_cases).toHaveLength(1)
  })
})

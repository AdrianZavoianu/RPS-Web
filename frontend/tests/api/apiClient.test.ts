import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../src/stores/authStore'
import { makeUser } from '../mocks/factories'
import { ApiHttpError, ApiNetworkError, ApiTimeoutError } from '../../src/types/errors'
import { server } from '../mocks/handlers'

// We mock global.fetch directly for these tests — disable MSW to avoid conflicts.

let apiClient: typeof import('../../src/api/client').apiClient
let buildQueryParams: typeof import('../../src/api/client').buildQueryParams

beforeEach(async () => {
  server.close()
  useAuthStore.getState().logout()

  const mod = await import('../../src/api/client')
  apiClient = mod.apiClient
  buildQueryParams = mod.buildQueryParams
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  server.listen({ onUnhandledRequest: 'bypass' })
})

// --- Existing query param tests (preserved) ---

describe('buildQueryParams', () => {
  it('builds query strings with scalar and array values', () => {
    const query = buildQueryParams({
      result_set_id: 7,
      direction: 'X',
      include_summary: true,
      result_types: ['Drifts', 'Forces'],
    })
    expect(query).toBe(
      '?result_set_id=7&direction=X&include_summary=true&result_types=Drifts%2CForces'
    )
  })

  it('omits nullish values and empty arrays', () => {
    const query = buildQueryParams({
      a: undefined,
      b: null,
      c: [],
    })
    expect(query).toBe('')
  })

  it('encodes characters safely', () => {
    const query = buildQueryParams({
      load_case: 'TH 01 / X+',
      note: 'a&b',
    })
    expect(query).toBe('?load_case=TH+01+%2F+X%2B&note=a%26b')
  })
})

// --- Auth & Retry tests ---

describe('api client auth', () => {
  function mockFetch(...responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
    const calls: Response[] = []
    let callIndex = 0

    vi.stubGlobal('fetch', vi.fn(async () => {
      const spec = responses[callIndex] ?? responses[responses.length - 1]
      callIndex++
      const response = new Response(JSON.stringify(spec.body ?? {}), {
        status: spec.status,
        statusText: spec.status === 200 ? 'OK' : 'Error',
        headers: { 'Content-Type': 'application/json', ...spec.headers },
      })
      calls.push(response)
      return response
    }))

    return { getCalls: () => callIndex, getFetch: () => vi.mocked(fetch) }
  }

  function loginUser() {
    useAuthStore.getState().login(makeUser(), 'valid-access', 'valid-refresh')
  }

  it('401 → refresh → retry with new token → success', async () => {
    loginUser()
    const { getFetch } = mockFetch(
      { status: 401, body: { detail: 'Token expired' } },
      { status: 200, body: { access: 'refreshed-token' } },
      { status: 200, body: { data: 'success' } }
    )

    const result = await apiClient.get<{ data: string }>('/test/')
    expect(result).toEqual({ data: 'success' })
    expect(getFetch()).toHaveBeenCalledTimes(3)

    // The third call should use the refreshed token
    const thirdCallArgs = getFetch().mock.calls[2]
    const headers = (thirdCallArgs[1] as RequestInit).headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer refreshed-token')
  })

  it('failed refresh → logout called', async () => {
    loginUser()
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout')

    mockFetch(
      { status: 401, body: { detail: 'Token expired' } },
      { status: 401, body: { detail: 'Refresh token invalid' } }
    )

    await expect(apiClient.get('/test/')).rejects.toThrow(ApiHttpError)
    expect(logoutSpy).toHaveBeenCalled()
  })

  it('auth endpoint exclusion — /auth/login/ gets 401 → no refresh attempt', async () => {
    loginUser()
    const { getCalls } = mockFetch(
      { status: 401, body: { detail: 'Bad credentials' } }
    )

    await expect(apiClient.post('/auth/login/', {})).rejects.toThrow(ApiHttpError)
    // Only 1 call — no refresh attempt
    expect(getCalls()).toBe(1)
  })

  it('auth endpoint exclusion — /auth/refresh/ gets 401 → no refresh attempt', async () => {
    loginUser()
    const { getCalls } = mockFetch(
      { status: 401, body: { detail: 'Bad refresh' } }
    )

    await expect(apiClient.post('/auth/refresh/', {})).rejects.toThrow(ApiHttpError)
    expect(getCalls()).toBe(1)
  })

  it('deduplicates concurrent refresh requests', async () => {
    loginUser()
    let callCount = 0

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      callCount++
      if (url.includes('/auth/refresh/')) {
        // Simulate small delay
        await new Promise((r) => setTimeout(r, 10))
        return new Response(JSON.stringify({ access: 'refreshed' }), { status: 200 })
      }
      if (callCount <= 3) {
        // First 3 calls are the initial requests that get 401
        return new Response(JSON.stringify({ detail: 'expired' }), { status: 401 })
      }
      // Retries succeed
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }))

    const [r1, r2, r3] = await Promise.all([
      apiClient.get('/a/'),
      apiClient.get('/b/'),
      apiClient.get('/c/'),
    ])

    // All should succeed
    expect(r1).toEqual({ ok: true })
    expect(r2).toEqual({ ok: true })
    expect(r3).toEqual({ ok: true })

    // Count refresh calls — should be exactly 1
    const refreshCalls = vi.mocked(fetch).mock.calls.filter(
      (call) => String(call[0]).includes('/auth/refresh/')
    )
    expect(refreshCalls).toHaveLength(1)
  })

  it('token rotation — refresh response includes new refresh token → both stored', async () => {
    loginUser()

    mockFetch(
      { status: 401, body: { detail: 'expired' } },
      { status: 200, body: { access: 'new-access', refresh: 'new-refresh' } },
      { status: 200, body: { ok: true } }
    )

    await apiClient.get('/test/')

    const state = useAuthStore.getState()
    expect(state.token).toBe('new-access')
    expect(state.refreshToken).toBe('new-refresh')
  })
})

// --- Error handling ---

describe('api client errors', () => {
  it('timeout → ApiTimeoutError', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      // Wait for signal abort
      return new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    }))

    await expect(apiClient.get('/slow/', 50)).rejects.toThrow(ApiTimeoutError)
  })

  it('network error → ApiNetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))

    await expect(apiClient.get('/offline/')).rejects.toThrow(ApiNetworkError)
  })

  it('extracts error detail from {detail: string}', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response(JSON.stringify({ detail: 'Permission denied' }), { status: 403 })
    }))

    try {
      await apiClient.get('/forbidden/')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError)
      expect((err as ApiHttpError).detail).toBe('Permission denied')
      expect((err as ApiHttpError).status).toBe(403)
    }
  })

  it('extracts error detail from {error: string}', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })
    }))

    try {
      await apiClient.get('/broken/')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError)
      expect((err as ApiHttpError).detail).toBe('Server error')
    }
  })

  it('extracts error detail from {message: string}', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 })
    }))

    try {
      await apiClient.get('/missing/')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError)
      expect((err as ApiHttpError).detail).toBe('Not found')
    }
  })

  it('extracts first element from array detail', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response(JSON.stringify({ detail: ['First error', 'Second error'] }), { status: 400 })
    }))

    try {
      await apiClient.post('/validate/', {})
      expect.fail('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ApiHttpError)
      expect((err as ApiHttpError).detail).toBe('First error')
    }
  })
})

// --- Response normalization ---

describe('api client response handling', () => {
  it('unwraps paginated responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response(
        JSON.stringify({ results: [{ id: 1 }, { id: 2 }], count: 2, next: null, previous: null }),
        { status: 200 }
      )
    }))

    const result = await apiClient.get<{ id: number }[]>('/paginated/')
    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('getBlob returns Blob, not JSON', async () => {
    const encoder = new TextEncoder()
    const data = encoder.encode('test data')
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response(data, {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' },
      })
    }))

    const result = await apiClient.getBlob('/download/')
    // jsdom cross-realm: Blob from Response may not pass instanceof check
    expect(typeof result.text).toBe('function')
    expect(typeof result.size).toBe('number')
    const text = await result.text()
    expect(text).toBe('test data')
  })

  it('upload omits Content-Type header', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }))

    const formData = new FormData()
    formData.append('file', new Blob(['test']), 'test.txt')
    await apiClient.upload('/upload/', formData)

    const callArgs = vi.mocked(fetch).mock.calls[0]
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })
})

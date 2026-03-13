import { useAuthStore } from '../stores/authStore'
import {
  ApiHttpError,
  ApiNetworkError,
  ApiTimeoutError,
  ApiUnknownError,
  isApiError,
} from '../types/errors'

const API_BASE = '/api'
const DEFAULT_TIMEOUT_MS = 30000

export type QueryParamScalar = string | number | boolean
export type QueryParamValue = QueryParamScalar | QueryParamScalar[] | null | undefined

export function buildQueryParams(params: Record<string, QueryParamValue>): string {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue
      }
      searchParams.set(key, value.map(item => String(item)).join(','))
      continue
    }
    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

class ApiClient {
  private refreshInFlight: Promise<string | null> | null = null

  private normalizeResponse<T>(data: T): T {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const payload = data as {
        results?: unknown
        count?: unknown
        next?: unknown
        previous?: unknown
      }
      if (
        Array.isArray(payload.results) &&
        ('count' in payload || 'next' in payload || 'previous' in payload)
      ) {
        return payload.results as T
      }
    }
    return data
  }

  private shouldAttemptTokenRefresh(endpoint: string): boolean {
    return endpoint !== '/auth/login/' && endpoint !== '/auth/refresh/' && endpoint !== '/auth/register/'
  }

  private getHeaders(accessToken?: string | null): HeadersInit {
    const token = accessToken === undefined ? useAuthStore.getState().token : accessToken
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  private getUploadHeaders(accessToken?: string | null): HeadersInit {
    const token = accessToken === undefined ? useAuthStore.getState().token : accessToken
    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  private handleUnauthorized(status: number): void {
    if (status === 401) {
      useAuthStore.getState().logout()
    }
  }

  private async refreshAccessToken(timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<string | null> {
    const refreshToken = useAuthStore.getState().refreshToken
    if (!refreshToken) {
      return null
    }

    if (this.refreshInFlight) {
      return this.refreshInFlight
    }

    const refreshPromise = (async () => {
      const response = await this.fetchWithTimeout(
        '/auth/refresh/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh: refreshToken }),
        },
        timeoutMs
      )

      if (!response.ok) {
        useAuthStore.getState().logout()
        return null
      }

      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        useAuthStore.getState().logout()
        return null
      }

      const accessToken = (payload as { access?: unknown }).access
      if (typeof accessToken !== 'string' || accessToken.length === 0) {
        useAuthStore.getState().logout()
        return null
      }

      const rotatedRefreshToken = (payload as { refresh?: unknown }).refresh
      if (typeof rotatedRefreshToken === 'string' && rotatedRefreshToken.length > 0) {
        useAuthStore.getState().setAccessToken(accessToken, rotatedRefreshToken)
      } else {
        useAuthStore.getState().setAccessToken(accessToken)
      }
      return accessToken
    })()

    this.refreshInFlight = refreshPromise
    refreshPromise.finally(() => {
      if (this.refreshInFlight === refreshPromise) {
        this.refreshInFlight = null
      }
    })

    return refreshPromise
  }

  private extractErrorDetail(payload: unknown): string | null {
    if (typeof payload === 'string') {
      const normalized = payload.trim()
      return normalized.length > 0 ? normalized : null
    }

    if (Array.isArray(payload)) {
      for (const item of payload) {
        const detail = this.extractErrorDetail(item)
        if (detail) {
          return detail
        }
      }
      return null
    }

    if (!payload || typeof payload !== 'object') {
      return null
    }

    const body = payload as Record<string, unknown>
    const preferredKeys = ['message', 'detail', 'error', 'non_field_errors', 'details']

    for (const key of preferredKeys) {
      if (!(key in body)) {
        continue
      }
      const detail = this.extractErrorDetail(body[key])
      if (detail) {
        return detail
      }
    }

    for (const value of Object.values(body)) {
      const detail = this.extractErrorDetail(value)
      if (detail) {
        return detail
      }
    }

    return null
  }

  private async buildHttpError(response: Response): Promise<ApiHttpError> {
    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    const detail = this.extractErrorDetail(payload)
    return new ApiHttpError(response.status, response.statusText, detail, payload)
  }

  private async fetchWithTimeout(
    endpoint: string,
    options: RequestInit,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        signal: controller.signal,
      })
    } catch (error) {
      if (isApiError(error)) {
        throw error
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiTimeoutError(timeoutMs, error)
      }
      if (error instanceof TypeError) {
        throw new ApiNetworkError('Network request failed', error)
      }
      throw new ApiUnknownError('Unexpected API error', error)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private async requestWithAuthRetry(
    endpoint: string,
    optionsFactory: (accessToken: string | null) => RequestInit,
    timeoutMs: number,
    allowTokenRefresh: boolean
  ): Promise<Response> {
    let response = await this.fetchWithTimeout(
      endpoint,
      optionsFactory(useAuthStore.getState().token),
      timeoutMs
    )

    if (response.status !== 401 || !allowTokenRefresh) {
      return response
    }

    const refreshedAccessToken = await this.refreshAccessToken(timeoutMs)
    if (!refreshedAccessToken) {
      return response
    }

    response = await this.fetchWithTimeout(
      endpoint,
      optionsFactory(refreshedAccessToken),
      timeoutMs
    )
    return response
  }

  async get<T>(endpoint: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<T> {
    const allowTokenRefresh = this.shouldAttemptTokenRefresh(endpoint)
    const response = await this.requestWithAuthRetry(
      endpoint,
      (accessToken) => ({
        method: 'GET',
        headers: this.getHeaders(accessToken),
      }),
      timeoutMs,
      allowTokenRefresh
    )
    if (!response.ok) {
      if (allowTokenRefresh) {
        this.handleUnauthorized(response.status)
      }
      throw await this.buildHttpError(response)
    }
    const data = await response.json()
    return this.normalizeResponse<T>(data)
  }

  async getBlob(endpoint: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Blob> {
    const allowTokenRefresh = this.shouldAttemptTokenRefresh(endpoint)
    const response = await this.requestWithAuthRetry(
      endpoint,
      (accessToken) => ({
        method: 'GET',
        headers: this.getHeaders(accessToken),
      }),
      timeoutMs,
      allowTokenRefresh
    )
    if (!response.ok) {
      if (allowTokenRefresh) {
        this.handleUnauthorized(response.status)
      }
      throw await this.buildHttpError(response)
    }
    return response.blob()
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    const allowTokenRefresh = this.shouldAttemptTokenRefresh(endpoint)
    const response = await this.requestWithAuthRetry(
      endpoint,
      (accessToken) => ({
        method: 'POST',
        headers: this.getHeaders(accessToken),
        body: data ? JSON.stringify(data) : undefined,
      }),
      timeoutMs,
      allowTokenRefresh
    )
    if (!response.ok) {
      if (allowTokenRefresh) {
        this.handleUnauthorized(response.status)
      }
      throw await this.buildHttpError(response)
    }
    const responseData = await response.json()
    return this.normalizeResponse<T>(responseData)
  }

  async postBlob(
    endpoint: string,
    data?: unknown,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<Blob> {
    const allowTokenRefresh = this.shouldAttemptTokenRefresh(endpoint)
    const response = await this.requestWithAuthRetry(
      endpoint,
      (accessToken) => ({
        method: 'POST',
        headers: this.getHeaders(accessToken),
        body: data ? JSON.stringify(data) : undefined,
      }),
      timeoutMs,
      allowTokenRefresh
    )
    if (!response.ok) {
      if (allowTokenRefresh) {
        this.handleUnauthorized(response.status)
      }
      throw await this.buildHttpError(response)
    }
    return response.blob()
  }

  async patch<T>(
    endpoint: string,
    data: unknown,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    const allowTokenRefresh = this.shouldAttemptTokenRefresh(endpoint)
    const response = await this.requestWithAuthRetry(
      endpoint,
      (accessToken) => ({
        method: 'PATCH',
        headers: this.getHeaders(accessToken),
        body: JSON.stringify(data),
      }),
      timeoutMs,
      allowTokenRefresh
    )
    if (!response.ok) {
      if (allowTokenRefresh) {
        this.handleUnauthorized(response.status)
      }
      throw await this.buildHttpError(response)
    }
    const responseData = await response.json()
    return this.normalizeResponse<T>(responseData)
  }

  async delete(endpoint: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<void> {
    const allowTokenRefresh = this.shouldAttemptTokenRefresh(endpoint)
    const response = await this.requestWithAuthRetry(
      endpoint,
      (accessToken) => ({
        method: 'DELETE',
        headers: this.getHeaders(accessToken),
      }),
      timeoutMs,
      allowTokenRefresh
    )
    if (!response.ok) {
      if (allowTokenRefresh) {
        this.handleUnauthorized(response.status)
      }
      throw await this.buildHttpError(response)
    }
  }

  async upload<T>(
    endpoint: string,
    formData: FormData,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    const allowTokenRefresh = this.shouldAttemptTokenRefresh(endpoint)
    const response = await this.requestWithAuthRetry(
      endpoint,
      (accessToken) => ({
        method: 'POST',
        headers: this.getUploadHeaders(accessToken),
        body: formData,
      }),
      timeoutMs,
      allowTokenRefresh
    )
    if (!response.ok) {
      if (allowTokenRefresh) {
        this.handleUnauthorized(response.status)
      }
      throw await this.buildHttpError(response)
    }
    const responseData = await response.json()
    return this.normalizeResponse<T>(responseData)
  }
}

export const apiClient = new ApiClient()

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

class ApiClient {
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

  private getHeaders(): HeadersInit {
    const token = useAuthStore.getState().token
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
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

  private extractErrorDetail(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null
    }
    const body = payload as { detail?: unknown; error?: unknown; message?: unknown }
    const candidates = [body.detail, body.error, body.message]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.length > 0) {
        return candidate
      }
      if (Array.isArray(candidate) && candidate.length > 0 && typeof candidate[0] === 'string') {
        return candidate[0]
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

  async get<T>(endpoint: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<T> {
    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      timeoutMs
    )
    if (!response.ok) {
      this.handleUnauthorized(response.status)
      throw await this.buildHttpError(response)
    }
    const data = await response.json()
    return this.normalizeResponse<T>(data)
  }

  async getBlob(endpoint: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Blob> {
    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'GET',
        headers: this.getHeaders(),
      },
      timeoutMs
    )
    if (!response.ok) {
      this.handleUnauthorized(response.status)
      throw await this.buildHttpError(response)
    }
    return response.blob()
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      },
      timeoutMs
    )
    if (!response.ok) {
      this.handleUnauthorized(response.status)
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
    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      },
      timeoutMs
    )
    if (!response.ok) {
      this.handleUnauthorized(response.status)
      throw await this.buildHttpError(response)
    }
    return response.blob()
  }

  async patch<T>(
    endpoint: string,
    data: unknown,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      },
      timeoutMs
    )
    if (!response.ok) {
      this.handleUnauthorized(response.status)
      throw await this.buildHttpError(response)
    }
    const responseData = await response.json()
    return this.normalizeResponse<T>(responseData)
  }

  async delete(endpoint: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<void> {
    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      },
      timeoutMs
    )
    if (!response.ok) {
      this.handleUnauthorized(response.status)
      throw await this.buildHttpError(response)
    }
  }

  async upload<T>(
    endpoint: string,
    formData: FormData,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    const token = useAuthStore.getState().token
    const headers: HeadersInit = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers,
        body: formData,
      },
      timeoutMs
    )
    if (!response.ok) {
      this.handleUnauthorized(response.status)
      throw await this.buildHttpError(response)
    }
    const responseData = await response.json()
    return this.normalizeResponse<T>(responseData)
  }
}

export const apiClient = new ApiClient()

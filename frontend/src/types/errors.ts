export type ApiErrorKind = 'http' | 'timeout' | 'network' | 'unknown'

abstract class ApiBaseError extends Error {
  abstract readonly kind: ApiErrorKind
  readonly cause: unknown

  protected constructor(message: string, cause: unknown = null) {
    super(message)
    this.name = new.target.name
    this.cause = cause
  }
}

export class ApiHttpError extends ApiBaseError {
  readonly kind = 'http' as const
  readonly status: number
  readonly statusText: string
  readonly detail: string | null
  readonly payload: unknown

  constructor(
    status: number,
    statusText: string,
    detail: string | null,
    payload: unknown = null,
    cause: unknown = null
  ) {
    super(detail || `API Error: ${status}`, cause)
    this.status = status
    this.statusText = statusText
    this.detail = detail
    this.payload = payload
  }
}

export class ApiTimeoutError extends ApiBaseError {
  readonly kind = 'timeout' as const
  readonly timeoutMs: number

  constructor(timeoutMs: number, cause: unknown = null) {
    super(`Request timeout after ${timeoutMs}ms`, cause)
    this.timeoutMs = timeoutMs
  }
}

export class ApiNetworkError extends ApiBaseError {
  readonly kind = 'network' as const

  constructor(message = 'Network request failed', cause: unknown = null) {
    super(message, cause)
  }
}

export class ApiUnknownError extends ApiBaseError {
  readonly kind = 'unknown' as const

  constructor(message = 'Unexpected API error', cause: unknown = null) {
    super(message, cause)
  }
}

export type ApiError =
  | ApiHttpError
  | ApiTimeoutError
  | ApiNetworkError
  | ApiUnknownError

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiBaseError
}

export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (isApiError(error)) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

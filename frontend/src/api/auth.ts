import { apiClient } from './client'
import type { User } from '../types'

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  user: User
  access: string
  refresh: string
}

export interface RefreshTokenRequest {
  refresh: string
}

export interface RefreshTokenResponse {
  access: string
}

export interface LogoutRequest {
  refresh: string
}

export interface LogoutResponse {
  message: string
}

export async function login(request: LoginRequest): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>('/auth/login/', request)
}

export async function refreshToken(
  request: RefreshTokenRequest
): Promise<RefreshTokenResponse> {
  return apiClient.post<RefreshTokenResponse>('/auth/refresh/', request)
}

export async function logout(request: LogoutRequest): Promise<LogoutResponse> {
  return apiClient.post<LogoutResponse>('/auth/logout/', request)
}

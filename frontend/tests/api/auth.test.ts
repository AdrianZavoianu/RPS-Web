import { afterEach, describe, expect, it, vi } from 'vitest'
import * as authApi from '../../src/api/auth'
import { apiClient } from '../../src/api/client'
import { makeUser } from '../mocks/factories'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('auth api', () => {
  it('login posts credentials to the login endpoint', async () => {
    const request = { username: 'engineer', password: 'secure-pass' }
    const response = {
      user: makeUser({ username: 'engineer' }),
      access: 'access-token',
      refresh: 'refresh-token',
    }

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(response as never)

    const result = await authApi.login(request)

    expect(postSpy).toHaveBeenCalledWith('/auth/login/', request)
    expect(result).toEqual(response)
  })

  it('refreshToken posts refresh token to the refresh endpoint', async () => {
    const request = { refresh: 'refresh-token' }
    const response = { access: 'next-access-token' }

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(response as never)

    const result = await authApi.refreshToken(request)

    expect(postSpy).toHaveBeenCalledWith('/auth/refresh/', request)
    expect(result).toEqual(response)
  })

  it('logout posts refresh token to the logout endpoint', async () => {
    const request = { refresh: 'refresh-token' }
    const response = { message: 'Logged out successfully' }

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(response as never)

    const result = await authApi.logout(request)

    expect(postSpy).toHaveBeenCalledWith('/auth/logout/', request)
    expect(result).toEqual(response)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../../src/stores/authStore'
import { makeUser } from '../mocks/factories'

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout()
  })

  it('starts with empty initial state', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('login sets user, tokens, and isAuthenticated', () => {
    const user = makeUser()
    useAuthStore.getState().login(user, 'access-123', 'refresh-456')

    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(state.token).toBe('access-123')
    expect(state.refreshToken).toBe('refresh-456')
    expect(state.isAuthenticated).toBe(true)
  })

  it('logout clears everything', () => {
    const user = makeUser()
    useAuthStore.getState().login(user, 'access-123', 'refresh-456')
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
    expect(state.refreshToken).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('setAccessToken updates access token and preserves refresh', () => {
    const user = makeUser()
    useAuthStore.getState().login(user, 'old-access', 'original-refresh')
    useAuthStore.getState().setAccessToken('new-access')

    const state = useAuthStore.getState()
    expect(state.token).toBe('new-access')
    expect(state.refreshToken).toBe('original-refresh')
  })

  it('setAccessToken rotates both tokens when refresh provided', () => {
    const user = makeUser()
    useAuthStore.getState().login(user, 'old-access', 'old-refresh')
    useAuthStore.getState().setAccessToken('new-access', 'new-refresh')

    const state = useAuthStore.getState()
    expect(state.token).toBe('new-access')
    expect(state.refreshToken).toBe('new-refresh')
  })

  it('setAccessToken keeps isAuthenticated based on user presence', () => {
    // No user → not authenticated even with token
    useAuthStore.getState().setAccessToken('some-token')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)

    // With user → authenticated
    const user = makeUser()
    useAuthStore.getState().login(user, 'access', 'refresh')
    useAuthStore.getState().setAccessToken('new-access')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})

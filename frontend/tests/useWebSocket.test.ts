// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWebSocketWithFallback } from '../src/hooks/useWebSocket'

class MockWebSocket {
  static instances: MockWebSocket[] = []

  static clear() {
    this.instances = []
  }

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  close = vi.fn(() => {
    this.onclose?.(new CloseEvent('close', { code: 1000 }))
  })

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this)
  }

  emitOpen() {
    this.onopen?.(new Event('open'))
  }

  emitMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }

  emitError() {
    this.onerror?.(new Event('error'))
  }

  emitClose(code = 1006) {
    this.onclose?.(new CloseEvent('close', { code }))
  }
}

describe('useWebSocketWithFallback', () => {
  beforeEach(() => {
    MockWebSocket.clear()
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not connect when disabled or missing URL', () => {
    const onMessage = vi.fn()
    const parseMessage = vi.fn(() => null)

    const disabled = renderHook(() =>
      useWebSocketWithFallback('ws://example', {
        enabled: false,
        parseMessage,
        onMessage,
      })
    )
    expect(disabled.result.current).toBe(false)
    expect(MockWebSocket.instances).toHaveLength(0)
    disabled.unmount()

    const noUrl = renderHook(() =>
      useWebSocketWithFallback(null, {
        enabled: true,
        parseMessage,
        onMessage,
      })
    )
    expect(noUrl.result.current).toBe(false)
    expect(MockWebSocket.instances).toHaveLength(0)
    noUrl.unmount()
  })

  it('connects and forwards parsed messages only', () => {
    const onMessage = vi.fn()
    const parseMessage = vi.fn((raw: string) => {
      try {
        return JSON.parse(raw) as { status: string }
      } catch {
        return null
      }
    })

    const { result, unmount } = renderHook(() =>
      useWebSocketWithFallback('ws://example', {
        enabled: true,
        parseMessage,
        onMessage,
      })
    )

    const socket = MockWebSocket.instances[0]
    expect(socket).toBeDefined()

    act(() => {
      socket.emitOpen()
    })
    expect(result.current).toBe(true)

    act(() => {
      socket.emitMessage('{"status":"ok"}')
      socket.emitMessage('invalid')
    })

    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(onMessage).toHaveBeenCalledWith({ status: 'ok' })
    expect(parseMessage).toHaveBeenCalledTimes(2)

    unmount()
    expect(socket.close).toHaveBeenCalledTimes(1)
  })

  it('reconnects after non-auth close using delay', () => {
    const parseMessage = (raw: string) => ({ raw })
    const onMessage = vi.fn()

    const { result } = renderHook(() =>
      useWebSocketWithFallback('ws://example', {
        enabled: true,
        parseMessage,
        onMessage,
        reconnectDelayMs: 1500,
      })
    )

    const socket = MockWebSocket.instances[0]
    act(() => {
      socket.emitOpen()
    })
    expect(result.current).toBe(true)

    act(() => {
      socket.emitClose(1006)
    })
    expect(result.current).toBe(false)
    expect(MockWebSocket.instances).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1499)
    })
    expect(MockWebSocket.instances).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('does not reconnect on auth close codes', () => {
    const parseMessage = (raw: string) => ({ raw })
    const onMessage = vi.fn()

    renderHook(() =>
      useWebSocketWithFallback('ws://example', {
        enabled: true,
        parseMessage,
        onMessage,
      })
    )

    const socket = MockWebSocket.instances[0]
    act(() => {
      socket.emitClose(4401)
      vi.advanceTimersByTime(2000)
    })

    expect(MockWebSocket.instances).toHaveLength(1)
  })
})

import { useEffect, useState } from 'react'

type MessageParser<T> = (raw: string) => T | null

type UseWebSocketWithFallbackOptions<T> = {
  enabled: boolean
  parseMessage: MessageParser<T>
  onMessage: (message: T) => void
  reconnectDelayMs?: number
  shouldReconnect?: (event: CloseEvent) => boolean
}

const DEFAULT_RECONNECT_DELAY_MS = 1500
const AUTH_CLOSE_CODES = new Set([4401, 4403])

function defaultShouldReconnect(event: CloseEvent): boolean {
  return !AUTH_CLOSE_CODES.has(event.code)
}

export function useWebSocketWithFallback<T>(
  url: string | null,
  {
    enabled,
    parseMessage,
    onMessage,
    reconnectDelayMs = DEFAULT_RECONNECT_DELAY_MS,
    shouldReconnect = defaultShouldReconnect,
  }: UseWebSocketWithFallbackOptions<T>
): boolean {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!enabled || !url || typeof window === 'undefined') {
      setIsConnected(false)
      return
    }

    let socket: WebSocket | null = null
    let reconnectTimer: number | null = null
    let cancelled = false

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const connect = () => {
      if (cancelled) return

      socket = new WebSocket(url)

      socket.onopen = () => {
        if (cancelled) return
        setIsConnected(true)
      }

      socket.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : null
        if (raw === null) return

        const parsed = parseMessage(raw)
        if (parsed === null) return
        onMessage(parsed)
      }

      socket.onerror = () => {
        if (cancelled) return
        setIsConnected(false)
      }

      socket.onclose = (event) => {
        if (cancelled) return
        setIsConnected(false)

        if (!shouldReconnect(event)) {
          return
        }

        clearReconnectTimer()
        reconnectTimer = window.setTimeout(connect, reconnectDelayMs)
      }
    }

    connect()

    return () => {
      cancelled = true
      clearReconnectTimer()
      setIsConnected(false)
      if (socket) {
        socket.close()
      }
    }
  }, [enabled, onMessage, parseMessage, reconnectDelayMs, shouldReconnect, url])

  return isConnected
}

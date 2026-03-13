import { useCallback, useMemo } from 'react'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { invalidateByPrefix } from './invalidation'
import { useWebSocketWithFallback } from './useWebSocket'

interface UseJobProgressTransportParams<TJob, TMessage> {
  enabled: boolean
  isTerminalMessage: (message: TMessage) => boolean
  jobId: number | null
  listQueryKey: QueryKey
  parseMessage: (raw: string) => TMessage | null
  queryKey: QueryKey
  socketResource: string
  token?: string | null
  updateJobFromMessage: (currentJob: TJob, message: TMessage) => TJob
}

export function useJobProgressTransport<TJob, TMessage>({
  enabled,
  isTerminalMessage,
  jobId,
  listQueryKey,
  parseMessage,
  queryKey,
  socketResource,
  token,
  updateJobFromMessage,
}: UseJobProgressTransportParams<TJob, TMessage>): boolean {
  const queryClient = useQueryClient()

  const socketUrl = useMemo(() => {
    if (!enabled || !jobId || typeof window === 'undefined') {
      return null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const baseUrl = `${protocol}//${window.location.host}/ws/${socketResource}/${jobId}/`
    return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl
  }, [enabled, jobId, socketResource, token])

  const handleSocketMessage = useCallback(
    (message: TMessage) => {
      queryClient.setQueryData<TJob | undefined>(queryKey, (currentJob) => {
        if (!currentJob) return currentJob
        return updateJobFromMessage(currentJob, message)
      })

      if (isTerminalMessage(message)) {
        invalidateByPrefix(queryClient, queryKey)
        invalidateByPrefix(queryClient, listQueryKey)
      }
    },
    [isTerminalMessage, listQueryKey, queryClient, queryKey, updateJobFromMessage]
  )

  return useWebSocketWithFallback<TMessage>(socketUrl, {
    enabled: enabled && !!jobId,
    parseMessage,
    onMessage: handleSocketMessage,
  })
}

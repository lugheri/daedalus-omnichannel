import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { io } from 'socket.io-client'
import { getAccessToken, refreshSession } from '@/lib/api/client'
import { env } from '@/lib/env'
import { conversationKeys } from '@/features/conversations/api'
import { RealtimeContext, type RealtimeStatus } from './realtime-context'

interface ConversationChanged {
  conversationId: string
  reason: 'message' | 'message-status' | 'status' | 'assignment'
}

/** Espera entre tentativas quando o servidor recusa o token (renova antes de tentar). */
const AUTH_RETRY_MS = [1_000, 3_000, 10_000, 30_000]

/**
 * Conexão em tempo real (Socket.IO) das telas logadas.
 *
 * O servidor manda só SINAIS ("a conversa X mudou"); aqui eles viram
 * invalidações do TanStack Query, e a tela busca os dados pela API.
 *
 * O token vai em `auth` a cada tentativa. Quando o servidor derruba a conexão
 * (token expirou) ou a recusa, a sessão é renovada pelo mesmo `refreshSession`
 * serializado do HTTP e a conexão é refeita.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    const socket = io(env.VITE_API_URL, {
      transports: ['websocket'],
      auth: (send) => send({ token: getAccessToken() }),
    })
    let authAttempts = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    /** Renova a sessão e reconecta (com espera crescente se continuar recusando). */
    const renewAndReconnect = () => {
      const wait = AUTH_RETRY_MS[Math.min(authAttempts++, AUTH_RETRY_MS.length - 1)]
      retryTimer = setTimeout(() => {
        // Sem sessão válida, a próxima chamada à API leva o usuário ao login.
        void refreshSession().finally(() => socket.connect())
      }, wait)
    }

    socket.on('connect', () => {
      authAttempts = 0
      setStatus('connected')
      // Pode ter perdido avisos enquanto esteve fora: atualiza o que está na tela.
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all })
    })

    socket.on('disconnect', (reason) => {
      setStatus('reconnecting')
      // Queda de rede o próprio Socket.IO refaz; derrubada pelo servidor
      // (token expirou), não — é preciso renovar e reconectar.
      if (reason === 'io server disconnect') renewAndReconnect()
    })

    socket.on('connect_error', (error) => {
      setStatus((current) => (current === 'connecting' ? current : 'reconnecting'))
      if (error.message === 'unauthorized') renewAndReconnect()
    })

    socket.on('conversation.changed', ({ conversationId, reason }: ConversationChanged) => {
      void queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] })
      void queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) })
      if (reason === 'message' || reason === 'message-status') {
        void queryClient.invalidateQueries({ queryKey: conversationKeys.messages(conversationId) })
      }
    })

    return () => {
      clearTimeout(retryTimer)
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [queryClient])

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>
}

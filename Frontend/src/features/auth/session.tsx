import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { refreshSession, setAccessToken, setSessionExpiredHandler } from '@/lib/api/client'
import { authApi } from './api'
import { SessionContext, type SessionContextValue, type SessionState } from './session-context'

/**
 * Estado da sessão da aplicação. Ao abrir a página, tenta renovar a sessão
 * pelo cookie (o access token não sobrevive a um reload, por design); se
 * conseguir, carrega quem é o usuário e o que ele pode fazer (/v1/me).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' })
  const queryClient = useQueryClient()

  const loadMe = useCallback(async () => {
    setState({ status: 'authenticated', me: await authApi.me() })
  }, [])

  const clear = useCallback(() => {
    setAccessToken(null)
    queryClient.clear() // dados da conta anterior não podem vazar para a próxima
    setState({ status: 'anonymous' })
  }, [queryClient])

  useEffect(() => {
    setSessionExpiredHandler(clear)
    let cancelled = false
    void (async () => {
      const ok = await refreshSession()
      if (cancelled) return
      if (ok) await loadMe().catch(clear)
      else setState({ status: 'anonymous' })
    })()
    return () => {
      cancelled = true
    }
  }, [clear, loadMe])

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      start: async (session) => {
        queryClient.clear()
        setAccessToken(session.accessToken)
        await loadMe()
      },
      end: async () => {
        await authApi.logOut().catch(() => undefined)
        clear()
      },
      switchAccount: async (tenantId) => {
        const session = await authApi.switchAccount(tenantId)
        queryClient.clear() // dados da conta anterior não podem vazar para a próxima
        setAccessToken(session.accessToken)
        await loadMe()
      },
      reload: loadMe,
    }),
    [state, queryClient, loadMe, clear],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

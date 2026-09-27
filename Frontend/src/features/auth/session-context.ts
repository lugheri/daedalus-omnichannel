import { createContext, useContext, useMemo } from 'react'
import type { Me, SessionStart } from './api'

export type SessionState =
  { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; me: Me }

export interface SessionContextValue {
  state: SessionState
  /** Depois de login, cadastro ou aceite de convite: guarda o token e carrega o /me. */
  start: (session: SessionStart) => Promise<void>
  end: () => Promise<void>
  /** Recarrega o /me (ex.: depois de mudar o próprio cargo). */
  reload: () => Promise<void>
}

export const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession precisa estar dentro de <SessionProvider>')
  return context
}

/** O usuário autenticado. Use só em telas protegidas (dentro de <RequireAuth>). */
export function useMe(): Me {
  const { state } = useSession()
  if (state.status !== 'authenticated') throw new Error('useMe fora de uma rota autenticada')
  return state.me
}

/**
 * Checa permissões para MONTAR a tela (esconder botões, itens de menu).
 * Não é segurança: a API checa tudo de novo por conta própria.
 */
export function usePermissions() {
  const me = useMe()
  return useMemo(() => {
    const granted = new Set(me.permissions)
    return {
      can: (permission: string) => granted.has(permission),
      canAny: (...permissions: string[]) => permissions.some((p) => granted.has(p)),
    }
  }, [me.permissions])
}

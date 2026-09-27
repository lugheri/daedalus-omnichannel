import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageSpinner } from '@/components/full-page-spinner'
import { usePermissions, useSession } from './session-context'

/** Só renderiza as rotas filhas com sessão ativa; senão, vai para o login. */
export function RequireAuth() {
  const { state } = useSession()
  const location = useLocation()

  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Telas de login/cadastro: quem já está logado vai direto para a aplicação. */
export function RedirectIfAuthenticated() {
  const { state } = useSession()

  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}

/** Rota que exige ao menos uma das permissões; sem ela, mostra um aviso. */
export function RequirePermission({ anyOf }: { anyOf: string[] }) {
  const { canAny } = usePermissions()
  if (canAny(...anyOf)) return <Outlet />
  return (
    <div className="text-muted-foreground py-16 text-center">
      <p className="text-foreground text-lg font-medium">Sem permissão</p>
      <p className="mt-1 text-sm">
        Seu cargo não dá acesso a esta área. Fale com um administrador.
      </p>
    </div>
  )
}

/** Mostra o conteúdo só se o usuário tiver ao menos uma das permissões. */
export function IfCan({ any, children }: { any: string[]; children: ReactNode }) {
  const { canAny } = usePermissions()
  return canAny(...any) ? children : null
}

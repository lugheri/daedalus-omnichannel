import { api, type AuthTokensResponse } from '@/lib/api/client'

export interface Tenant {
  id: string
  name: string
  slug: string
  status: 'trial' | 'active' | 'suspended'
  /** Revendedor (ou a raiz): pode criar contas abaixo. */
  canCreateChildren?: boolean
  /** A conta da plataforma (mantém os modelos de site). */
  isRoot?: boolean
}

/** Uma conta citada por id e nome (mãe, origem do acesso). */
export interface AccountRef {
  id: string
  name: string
}

export interface RoleSummary {
  id: string
  key: 'owner' | 'admin' | 'supervisor' | 'agent' | 'parent_access' | null
  name: string
}

export interface Me {
  user: { id: string; name: string; email: string }
  tenant: Tenant
  /** O vínculo do usuário nesta conta (id usado em responsável e remetente). */
  membershipId: string
  role: RoleSummary
  permissions: string[]
  /** Quem gerencia esta conta (conta-mãe), se houver. */
  parent: AccountRef | null
  /** Entrou vindo de uma conta acima (acesso da conta-mãe): de qual. */
  delegatedFrom: AccountRef | null
}

export type SessionStart = AuthTokensResponse & { tenant: Tenant }

export type LogInResponse = SessionStart | { tenantSelectionRequired: true; tenants: Tenant[] }

export interface InvitationPreview {
  tenant: Tenant
  email: string
  role: RoleSummary
  requiresSignup: boolean
}

export const authApi = {
  signUp: (input: { accountName: string; name: string; email: string; password: string }) =>
    api<SessionStart>('/v1/auth/signup', { method: 'POST', body: input }),

  logIn: (input: { email: string; password: string; tenantId?: string }) =>
    api<LogInResponse>('/v1/auth/login', { method: 'POST', body: input }),

  logOut: () => api<void>('/v1/auth/logout', { method: 'POST' }),

  me: () => api<Me>('/v1/me'),

  /** Contas em que a pessoa pode entrar (seletor de conta). */
  accounts: () => api<Tenant[]>('/v1/me/accounts'),

  /** Nova sessão na conta escolhida; a da conta atual é encerrada pela API. */
  switchAccount: (tenantId: string) =>
    api<SessionStart>('/v1/auth/switch-account', { method: 'POST', body: { tenantId } }),

  lookUpInvitation: (token: string) =>
    api<InvitationPreview>('/v1/invitations/lookup', { query: { token } }),

  acceptInvitation: (input: { token: string; password: string; name?: string }) =>
    api<SessionStart>('/v1/invitations/accept', { method: 'POST', body: input }),
}

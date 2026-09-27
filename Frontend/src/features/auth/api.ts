import { api, type AuthTokensResponse } from '@/lib/api/client'

export interface Tenant {
  id: string
  name: string
  slug: string
  status: 'trial' | 'active' | 'suspended'
}

export interface RoleSummary {
  id: string
  key: 'owner' | 'admin' | 'supervisor' | 'agent' | null
  name: string
}

export interface Me {
  user: { id: string; name: string; email: string }
  tenant: Tenant
  /** O vínculo do usuário nesta conta (id usado em responsável e remetente). */
  membershipId: string
  role: RoleSummary
  permissions: string[]
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

  lookUpInvitation: (token: string) =>
    api<InvitationPreview>('/v1/invitations/lookup', { query: { token } }),

  acceptInvitation: (input: { token: string; password: string; name?: string }) =>
    api<SessionStart>('/v1/invitations/accept', { method: 'POST', body: input }),
}

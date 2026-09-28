import { env } from '@/lib/env'
import { ApiError } from './api-error'

/**
 * Cliente HTTP da API.
 *
 * Sessão (ADR 0005): o access token fica SÓ em memória (nunca em
 * localStorage) e o refresh token num cookie HttpOnly que o JavaScript não
 * lê. Quando o access token expira (401), o cliente renova a sessão pelo
 * cookie e repete a requisição, sem o usuário perceber.
 *
 * Cuidado com renovações concorrentes: o backend revoga a sessão inteira se
 * o mesmo refresh token for usado duas vezes (proteção contra roubo). Por
 * isso só UMA renovação acontece por vez — na aba (promise compartilhada) e
 * entre abas (Web Locks API; o cookie é compartilhado entre abas).
 */

export interface AuthTokensResponse {
  tokenType: 'Bearer'
  accessToken: string
  expiresIn: number
}

let accessToken: string | null = null
let refreshInFlight: Promise<boolean> | null = null
let onSessionExpired: () => void = () => {}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

/** O token atual, para conexões fora do fetch (WebSocket). Nunca persistir. */
export function getAccessToken(): string | null {
  return accessToken
}

/** Chamado quando a sessão não pode mais ser renovada (a app volta ao login). */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler
}

/** Renova o access token pelo cookie. `false` se não há sessão válida. */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= withCrossTabLock(async () => {
    try {
      const response = await fetch(`${env.VITE_API_URL}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) {
        accessToken = null
        return false
      }
      accessToken = ((await response.json()) as AuthTokensResponse).accessToken
      return true
    } catch {
      return false // rede fora: não derruba a sessão, só não renova agora
    }
  }).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | undefined>
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(path, options)
  // Respostas sem corpo (204, ou 202 de comandos enfileirados, como /connect).
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Arquivo binário (ex.: mídia de uma mensagem), com a mesma sessão/renovação do `api()`. */
export async function apiBlob(path: string): Promise<Blob> {
  return (await request(path)).blob()
}

/** Requisição autenticada; num 401 de token expirado, renova e tenta de novo, uma vez. */
async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  let response = await send(path, options)

  if (response.status === 401 && (await isExpiredAccessToken(response))) {
    if (await refreshSession()) {
      response = await send(path, options)
    } else {
      onSessionExpired()
    }
  }

  if (!response.ok) throw await ApiError.fromResponse(response)
  return response
}

async function send(path: string, { method = 'GET', body, query }: RequestOptions) {
  const url = new URL(`${env.VITE_API_URL}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  // FormData (upload): o navegador monta o content-type multipart com o boundary.
  const isForm = body instanceof FormData
  const headers: Record<string, string> = {}
  if (body !== undefined && !isForm) headers['content-type'] = 'application/json'
  if (accessToken) headers.authorization = `Bearer ${accessToken}`

  try {
    return await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      // Necessário para o cookie de sessão ir/voltar nas rotas /v1/auth.
      credentials: 'include',
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error')
  }
}

async function isExpiredAccessToken(response: Response): Promise<boolean> {
  const body = (await response
    .clone()
    .json()
    .catch(() => ({}))) as { code?: string }
  return body.code === 'AUTH_INVALID_ACCESS_TOKEN'
}

function withCrossTabLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request('omnichannel:auth-refresh', work)
  }
  return work()
}

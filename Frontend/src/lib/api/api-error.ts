/** Erro vindo da API no formato padrão do backend: `{ code, message, issues? }`. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly issues: { path: string; message: string }[]

  constructor(
    status: number,
    code: string,
    message: string,
    issues: { path: string; message: string }[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.issues = issues
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    const body = (await response.json().catch(() => ({}))) as {
      code?: string
      message?: string
      issues?: { path: string; message: string }[]
    }
    return new ApiError(
      response.status,
      body.code ?? `HTTP_${response.status}`,
      body.message ?? response.statusText,
      body.issues,
    )
  }
}

/**
 * Mensagens para o usuário, por `code` (o texto da API é técnico e em inglês).
 * Código desconhecido cai numa mensagem genérica.
 */
const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Não foi possível falar com o servidor. Verifique sua conexão.',
  VALIDATION_ERROR: 'Alguns campos estão inválidos.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  ORIGIN_NOT_ALLOWED: 'Origem não autorizada.',
  AUTH_INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  AUTH_ACCOUNT_ACCESS_DENIED: 'Você não tem acesso ativo a esta conta.',
  AUTH_INVALID_ACCESS_TOKEN: 'Sua sessão expirou. Entre novamente.',
  AUTH_INVALID_REFRESH_TOKEN: 'Sua sessão expirou. Entre novamente.',
  AUTH_MISSING_PERMISSION: 'Você não tem permissão para esta ação.',
  AUTH_CANNOT_GRANT: 'Você não pode conceder permissões que você mesmo não tem.',
  USER_EMAIL_ALREADY_IN_USE: 'Este e-mail já está cadastrado. Entre com ele.',
  USER_WEAK_PASSWORD: 'A senha precisa ter entre 8 e 128 caracteres.',
  USER_INVALID_EMAIL: 'E-mail inválido.',
  USER_INVALID_NAME: 'Informe seu nome.',
  ACCOUNT_INVALID_NAME: 'O nome da empresa precisa ter entre 2 e 100 caracteres.',
  ACCOUNT_LAST_OWNER: 'A conta precisa manter pelo menos um Owner ativo.',
  MEMBER_NOT_FOUND: 'Membro não encontrado.',
  MEMBER_ALREADY_EXISTS: 'Esta pessoa já é membro da conta.',
  MEMBER_CANNOT_DISABLE_SELF: 'Você não pode desativar o seu próprio acesso.',
  INVITATION_NOT_FOUND: 'Convite inválido, expirado ou já utilizado.',
  INVITATION_INVALID_EMAIL: 'E-mail inválido.',
  ROLE_NOT_FOUND: 'Cargo não encontrado.',
  ROLE_IN_USE: 'Este cargo está em uso por membros ou convites pendentes.',
  ROLE_NAME_TAKEN: 'Já existe um cargo com este nome.',
  ROLE_SYSTEM_IMMUTABLE: 'O cargo Owner não pode ser alterado nem excluído.',
  ROLE_INVALID: 'Cargo inválido.',
  CONTACT_INVALID_PHONE: 'Telefone inválido. Use o formato internacional, ex.: +55 11 98765-4321.',
  CONTACT_INVALID_EMAIL: 'E-mail inválido.',
  CONTACT_WITHOUT_IDENTIFIER: 'Informe ao menos um telefone ou e-mail.',
  CONTACT_ALREADY_EXISTS: 'Já existe um contato com este telefone ou e-mail.',
  CONTACT_NOT_FOUND: 'Contato não encontrado.',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? 'Algo deu errado. Tente novamente.'
  return 'Algo deu errado. Tente novamente.'
}

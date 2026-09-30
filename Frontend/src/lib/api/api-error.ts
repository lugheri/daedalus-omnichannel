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
  CONTACT_INVALID_PHONE: 'Telefone inválido. Informe com DDD, ex.: (11) 98765-4321.',
  CONTACT_INVALID_EMAIL: 'E-mail inválido.',
  CONTACT_WITHOUT_IDENTIFIER: 'Informe ao menos um telefone ou e-mail.',
  CONTACT_ALREADY_EXISTS: 'Já existe um contato com este telefone ou e-mail.',
  CONTACT_NOT_FOUND: 'Contato não encontrado.',
  API_KEY_NOT_FOUND: 'Chave não encontrada.',
  API_KEY_INVALID_NAME: 'O nome da chave precisa ter entre 1 e 60 caracteres.',
  IMPORT_NO_COLUMNS:
    'A planilha precisa de uma coluna de telefone ou de e-mail (ex.: Telefone, Celular, E-mail).',
  IMPORT_TOO_MANY_ROWS: 'A planilha passa de 2.000 linhas. Divida em arquivos menores.',
  IMPORT_EMPTY: 'A planilha não tem linhas com dados.',
  IMPORT_FILE_MISSING: 'Escolha um arquivo CSV.',
  CONTACT_NOTE_INVALID: 'A nota precisa ter entre 1 e 5000 caracteres.',
  CONTACT_NOTE_NOT_YOURS: 'Só quem escreveu pode apagar a nota.',
  CONTACT_NOTE_NOT_FOUND: 'Nota não encontrada.',
  CHANNEL_NOT_FOUND: 'Canal não encontrado.',
  CHANNEL_INVALID_NAME: 'O nome do canal precisa ter entre 1 e 60 caracteres.',
  CHANNEL_NOT_CONNECTED: 'O canal não está conectado.',
  CONVERSATION_NOT_FOUND: 'Conversa não encontrada.',
  CONVERSATION_CONTACT_WITHOUT_PHONE: 'O contato desta conversa não tem telefone para responder.',
  MESSAGE_INVALID_TEXT: 'A mensagem precisa ter entre 1 e 4096 caracteres.',
  TEAM_NOT_FOUND: 'Equipe não encontrada.',
  TEAM_NAME_TAKEN: 'Já existe uma equipe com este nome.',
  TEAM_INVALID_NAME: 'O nome da equipe precisa ter entre 1 e 60 caracteres.',
  TEAM_INVALID_MEMBERS: 'Algum membro escolhido não está ativo na conta.',
  CHANNEL_TEAM_NOT_FOUND: 'Equipe não encontrada.',
  CONVERSATION_ALREADY_ASSIGNED: 'Outra pessoa já assumiu esta conversa.',
  CONVERSATION_INVALID_ASSIGNEE: 'O responsável escolhido não está ativo na conta.',
  CONVERSATION_INVALID_TEAM: 'Equipe não encontrada.',
  CONVERSATION_DISPOSITION_REQUIRED: 'Escolha uma tabulação para resolver o atendimento.',
  CONVERSATION_DISPOSITION_NOTE_INVALID: 'A observação pode ter no máximo 1000 caracteres.',
  AUTOMATION_NOT_FOUND: 'Automação não encontrada.',
  AUTOMATION_INVALID_TRIGGER: 'Gatilho inválido.',
  AUTOMATION_INVALID_ACTIONS:
    'Escolha de 1 a 5 ações (os gatilhos de “mover para cá” não têm ações).',
  AUTOMATION_INVALID_MESSAGE: 'A mensagem precisa ter entre 1 e 2000 caracteres.',
  AUTOMATION_INVALID_ASSIGN: 'Na atribuição, escolha a equipe e/ou a pessoa.',
  AUTOMATION_INVALID_MOVE:
    'Mover só vale no gatilho de tempo parado, para outra coluna deste quadro.',
  AUTOMATION_INVALID_IDLE_TIME: 'O tempo parado vai de 1 minuto a 90 dias.',
  AUTOMATION_INVALID_TEAM: 'Equipe não encontrada.',
  AUTOMATION_INVALID_ASSIGNEE: 'A pessoa escolhida não está ativa na conta.',
  AUTOMATION_INVALID_DISPOSITION: 'Tabulação não encontrada.',
  AUTOMATION_TOO_MANY: 'Uma coluna pode ter no máximo 10 automações.',
  CAMPAIGN_NOT_FOUND: 'Campanha não encontrada.',
  CAMPAIGN_INVALID_NAME: 'O nome precisa ter entre 1 e 100 caracteres.',
  CAMPAIGN_INVALID_SUBJECT: 'Informe o assunto do e-mail (até 200 caracteres).',
  CAMPAIGN_INVALID_BODY: 'Escreva a mensagem (SMS: até 1550 caracteres, por causa do rodapé).',
  CAMPAIGN_INVALID_SCHEDULE: 'Escolha uma data futura, em até 90 dias.',
  CAMPAIGN_NOT_EDITABLE: 'A campanha já começou: não dá mais para mudar.',
  CAMPAIGN_NOT_CANCELABLE: 'Esta campanha não pode ser cancelada (rascunho: exclua).',
  CAMPAIGN_CANCELED: 'Não enviada: a campanha foi cancelada.',
  MESSAGING_OPTED_OUT: 'O contato pediu para não receber mensagens por este canal.',
  MESSAGING_CONTACT_WITHOUT_ADDRESS: 'O contato não tem endereço para este canal.',
  MESSAGING_CONTACT_NOT_FOUND: 'Contato não encontrado.',
  MESSAGING_INVALID_SUBJECT: 'O assunto precisa ter entre 1 e 200 caracteres.',
  MESSAGING_INVALID_BODY: 'Escreva a mensagem (SMS: até 1600 caracteres).',
  MESSAGING_INVALID_WEBHOOK_KEY: 'Chave de verificação inválida (copie do SendGrid, em base64).',
  MESSAGING_NOT_CONFIGURED: 'Configure o provedor deste canal em Configurações → E-mail e SMS.',
  MESSAGING_PROVIDER_REJECTED:
    'O provedor recusou o envio. Confira a mensagem de erro no cartão do provedor.',
  MESSAGING_PROVIDER_UNAVAILABLE: 'O provedor não respondeu. Tente de novo em instantes.',
  MESSAGING_INVALID_PROVIDER: 'Provedor inválido.',
  MESSAGING_INVALID_FROM_EMAIL: 'E-mail do remetente inválido.',
  MESSAGING_INVALID_FROM_NAME: 'O nome do remetente precisa ter entre 1 e 100 caracteres.',
  MESSAGING_INVALID_REPLY_TO: 'E-mail de resposta inválido.',
  MESSAGING_INVALID_ACCOUNT_SID: 'Account SID inválido (começa com AC e tem 34 caracteres).',
  MESSAGING_INVALID_SENDER:
    'Informe o número remetente (com DDI/DDD) ou o Messaging Service SID (começa com MG) — um dos dois.',
  MESSAGING_INVALID_SECRET: 'Chave/token com formato inválido.',
  MESSAGING_SECRET_REQUIRED: 'Informe a chave de API / Auth Token.',
  MESSAGING_INVALID_RECIPIENT: 'Destinatário inválido para este canal.',
  BOARD_NOT_FOUND: 'Quadro não encontrado.',
  BOARD_COLUMN_NOT_FOUND: 'Coluna não encontrada neste quadro.',
  BOARD_CARD_NOT_FOUND: 'Card não encontrado (talvez tenha sido movido ou removido).',
  BOARD_CONVERSATION_NOT_FOUND: 'Conversa não encontrada.',
  BOARD_NAME_TAKEN: 'Já existe um quadro com este nome.',
  BOARD_COLUMN_NAME_TAKEN: 'Já existe uma coluna com este nome no quadro.',
  BOARD_COLUMN_NOT_EMPTY: 'A coluna tem cards: escolha para qual coluna eles vão.',
  BOARD_CARD_ALREADY_EXISTS: 'A conversa já está neste quadro.',
  BOARD_INVALID_TEAM: 'Equipe não encontrada.',
  BOARD_INVALID_NAME: 'O nome do quadro precisa ter entre 1 e 60 caracteres.',
  BOARD_INVALID_COLUMN_NAME: 'O nome da coluna precisa ter entre 1 e 40 caracteres.',
  BOARD_TOO_MANY_COLUMNS: 'Um quadro pode ter no máximo 20 colunas.',
  BOARD_NEEDS_COLUMN: 'O quadro precisa de ao menos uma coluna.',
  BOARD_INVALID_AUTO_ADD: 'Escolha a equipe da entrada automática.',
  DISPOSITION_NOT_FOUND: 'Tabulação não encontrada ou arquivada.',
  DISPOSITION_INVALID_NAME: 'O nome da tabulação precisa ter entre 1 e 60 caracteres.',
  DISPOSITION_INVALID_COLOR: 'Cor inválida.',
  DISPOSITION_NAME_TAKEN: 'Já existe uma tabulação com este nome.',
  DISPOSITION_IN_USE: 'Esta tabulação já foi usada em atendimentos. Arquive-a em vez de excluir.',
  ATTACHMENT_TOO_LARGE: 'Arquivo grande demais (máximo 25 MB).',
  ATTACHMENT_MISSING: 'Escolha um arquivo para enviar.',
  ATTACHMENT_EMPTY: 'O arquivo está vazio.',
  MEDIA_NOT_FOUND: 'Arquivo não encontrado.',
  CHANNEL_STILL_ACTIVE: 'Desconecte o canal antes de removê-lo.',
  CHANNEL_INVALID_RECIPIENT: 'Número inválido. Informe com DDD, ex.: (11) 98765-4321.',
}

/** Mensagem de um código de erro solto (ex.: erros por linha da importação). */
export function messageForCode(code: string): string {
  return MESSAGES[code] ?? 'Algo deu errado. Tente novamente.'
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return messageForCode(error.code)
  return 'Algo deu errado. Tente novamente.'
}

import { defineJob } from '../shared/application/job-queue';

/**
 * Contrato entre o processo `whatsapp-connector` (Baileys) e o resto do
 * sistema (ADR 0006). É o ÚNICO código que os dois lados compartilham: toda a
 * comunicação é por filas. Se o conector virar um serviço separado, este
 * arquivo vira um pacote compartilhado — por isso é versionado com cuidado:
 * mudar o formato de um job quebra jobs já enfileirados.
 */

/** Comandos PARA o conector. */
export const WHATSAPP_CONNECTOR_QUEUE = 'whatsapp-connector';
/** Relatos DO conector, processados pelo worker (módulo channels). */
export const WHATSAPP_EVENTS_QUEUE = 'whatsapp-events';

// ─── Comandos (sistema → conector) ──────────────────────────────────────────

/** Conectar o número (se nunca pareado, gera QR code). */
export const StartWhatsAppSession = defineJob<{ channelId: string; tenantId: string }>(
  WHATSAPP_CONNECTOR_QUEUE,
  'start-session',
);

/** Desconectar. Com `logout`, desfaz o pareamento (será preciso novo QR). */
export const StopWhatsAppSession = defineJob<{ channelId: string; logout: boolean }>(
  WHATSAPP_CONNECTOR_QUEUE,
  'stop-session',
);

/** Canal removido: encerrar a sessão (se houver) e apagar tudo que o conector guarda dele. */
export const PurgeWhatsAppSession = defineJob<{ channelId: string }>(
  WHATSAPP_CONNECTOR_QUEUE,
  'purge-session',
);

/** Enviar texto. `messageId` é o id da mensagem do nosso lado (idempotência). */
export const SendWhatsAppText = defineJob<{
  channelId: string;
  tenantId: string;
  messageId: string;
  /** Número em E.164 (+5511...). */
  to: string;
  text: string;
}>(WHATSAPP_CONNECTOR_QUEUE, 'send-text');

// ─── Relatos (conector → sistema) ───────────────────────────────────────────

export type WhatsAppConnectionStatus =
  | 'awaiting_qr' //  esperando o QR code ser escaneado
  | 'connecting'
  | 'connected'
  | 'disconnected' // caiu; o conector tenta reconectar sozinho
  | 'logged_out'; //  pareamento desfeito (pelo celular ou por nós); precisa de novo QR

export const WhatsAppConnectionChanged = defineJob<{
  channelId: string;
  tenantId: string;
  status: WhatsAppConnectionStatus;
  /** Número conectado (E.164), quando conhecido. */
  phoneNumber: string | null;
  reason: string | null;
  at: string;
}>(WHATSAPP_EVENTS_QUEUE, 'connection-changed');

export type WhatsAppMessageKind =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'unsupported';

/** Mensagem de uma conversa 1:1 (recebida, ou enviada pelo próprio celular). */
export const WhatsAppMessageReceived = defineJob<{
  channelId: string;
  tenantId: string;
  /** Id da mensagem no WhatsApp — chave de idempotência. */
  externalId: string;
  /** Telefone (E.164) do outro lado da conversa, quando o WhatsApp o expõe. */
  contactPhone: string | null;
  /** Identificador do WhatsApp do outro lado (telefone ou LID). */
  contactJid: string;
  contactName: string | null;
  /** true = enviada pelo número conectado (ex.: respondida direto no celular). */
  fromMe: boolean;
  kind: WhatsAppMessageKind;
  text: string | null;
  sentAt: string;
}>(WHATSAPP_EVENTS_QUEUE, 'message-received');

/** Resultado de um SendWhatsAppText. */
export const WhatsAppMessageSendResult = defineJob<{
  channelId: string;
  tenantId: string;
  messageId: string;
  status: 'sent' | 'failed';
  externalId: string | null;
  error: string | null;
}>(WHATSAPP_EVENTS_QUEUE, 'send-result');

// ─── Estado efêmero no Redis ────────────────────────────────────────────────

/** QR code atual do canal (texto a ser renderizado como QR). */
export const whatsAppQrCodeKey = (channelId: string) => `whatsapp:qr:${channelId}`;
export const WHATSAPP_QR_TTL_SECONDS = 60;

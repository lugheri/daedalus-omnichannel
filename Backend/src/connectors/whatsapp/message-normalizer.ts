import {
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isPnUser,
  jidDecode,
  normalizeMessageContent,
  toNumber,
  type WAMessage,
} from 'baileys';
import type { WhatsAppMessageKind } from '../../contracts/whatsapp-connector.contract';

export interface NormalizedMessage {
  externalId: string;
  contactJid: string;
  contactPhone: string | null;
  contactName: string | null;
  fromMe: boolean;
  kind: WhatsAppMessageKind;
  text: string | null;
  sentAt: string;
  /** O que a mensagem declara do arquivo anexo (o download é do WhatsAppSession). */
  attachment: Attachment | null;
}

export interface Attachment {
  mimeType: string;
  fileName: string | null;
  /** Tamanho informado pelo WhatsApp (bytes), para recusar arquivos grandes antes de baixar. */
  declaredSize: number | null;
}

/**
 * Traduz uma mensagem do Baileys para o formato do contrato. Devolve `null`
 * para o que não é conversa 1:1 com conteúdo: grupos, status, canais,
 * reações, confirmações e mensagens de protocolo.
 */
export function normalizeMessage(message: WAMessage): NormalizedMessage | null {
  const { key } = message;
  const jid = key.remoteJid;
  if (!key.id || !jid) return null;
  if (isJidGroup(jid) || isJidBroadcast(jid) || isJidNewsletter(jid)) return null;

  const content = describe(normalizeMessageContent(message.message));
  if (!content) return null;

  const fromMe = key.fromMe ?? false;
  return {
    externalId: key.id,
    contactJid: jid,
    contactPhone: phoneOf(jid) ?? phoneOf(key.remoteJidAlt),
    contactName: fromMe ? null : (message.pushName ?? null),
    fromMe,
    kind: content.kind,
    text: content.text,
    attachment: content.attachment ?? null,
    sentAt: new Date(toNumber(message.messageTimestamp) * 1000 || Date.now()).toISOString(),
  };
}

/**
 * Telefone em E.164 a partir de um JID de telefone (`5511...@s.whatsapp.net`).
 * JIDs "LID" (`...@lid`, v7 do WhatsApp) não carregam o número.
 */
export function phoneOf(jid: string | null | undefined): string | null {
  if (!jid || !isPnUser(jid)) return null;
  const user = jidDecode(jid)?.user;
  return user ? `+${user}` : null;
}

/** JID de telefone para envio: `+5511987654321` → `5511987654321@s.whatsapp.net`. */
export function jidOf(phone: string): string {
  return `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
}

type Content = NonNullable<WAMessage['message']>;

interface Described {
  kind: WhatsAppMessageKind;
  text: string | null;
  attachment?: Attachment;
}

function attachmentOf(media: {
  mimetype?: string | null;
  fileLength?: Parameters<typeof toNumber>[0] | null;
  fileName?: string | null;
}): Attachment {
  return {
    mimeType: media.mimetype ?? 'application/octet-stream',
    fileName: media.fileName ?? null,
    declaredSize: media.fileLength == null ? null : toNumber(media.fileLength),
  };
}

function describe(content: Content | undefined): Described | null {
  if (!content) return null;
  if (content.conversation) return { kind: 'text', text: content.conversation };
  if (content.extendedTextMessage) {
    return { kind: 'text', text: content.extendedTextMessage.text ?? null };
  }
  const { imageMessage, videoMessage, audioMessage, documentMessage, stickerMessage } = content;
  if (imageMessage) {
    return {
      kind: 'image',
      text: imageMessage.caption ?? null,
      attachment: attachmentOf(imageMessage),
    };
  }
  if (videoMessage) {
    return {
      kind: 'video',
      text: videoMessage.caption ?? null,
      attachment: attachmentOf(videoMessage),
    };
  }
  if (audioMessage) return { kind: 'audio', text: null, attachment: attachmentOf(audioMessage) };
  if (documentMessage) {
    return {
      kind: 'document',
      text: documentMessage.caption ?? null,
      attachment: attachmentOf(documentMessage),
    };
  }
  if (stickerMessage)
    return { kind: 'sticker', text: null, attachment: attachmentOf(stickerMessage) };
  if (content.locationMessage || content.liveLocationMessage)
    return { kind: 'location', text: null };
  if (content.contactMessage || content.contactsArrayMessage)
    return { kind: 'contact', text: null };

  // Sem conteúdo para a conversa: reações, edições/remoções, chaves, enquetes...
  if (
    content.protocolMessage ||
    content.reactionMessage ||
    content.senderKeyDistributionMessage ||
    content.pollUpdateMessage
  ) {
    return null;
  }
  return { kind: 'unsupported', text: null };
}

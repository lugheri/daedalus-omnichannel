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

function describe(
  content: Content | undefined,
): { kind: WhatsAppMessageKind; text: string | null } | null {
  if (!content) return null;
  if (content.conversation) return { kind: 'text', text: content.conversation };
  if (content.extendedTextMessage) {
    return { kind: 'text', text: content.extendedTextMessage.text ?? null };
  }
  if (content.imageMessage) return { kind: 'image', text: content.imageMessage.caption ?? null };
  if (content.videoMessage) return { kind: 'video', text: content.videoMessage.caption ?? null };
  if (content.audioMessage) return { kind: 'audio', text: null };
  if (content.documentMessage) {
    return {
      kind: 'document',
      text: content.documentMessage.caption ?? content.documentMessage.fileName ?? null,
    };
  }
  if (content.stickerMessage) return { kind: 'sticker', text: null };
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

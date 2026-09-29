import type { MessagingChannel } from '../../domain/messaging-provider.entity';

export interface UnsubscribeTarget {
  tenantId: string;
  channel: MessagingChannel;
  address: string;
}

/**
 * Token do link de descadastro: assinado (não dá para forjar o de outro
 * endereço) e sem estado no banco.
 */
export interface UnsubscribeTokens {
  create(target: UnsubscribeTarget): string;
  /** null se adulterado ou malformado. */
  verify(token: string): UnsubscribeTarget | null;
}

export const UNSUBSCRIBE_TOKENS = Symbol('UnsubscribeTokens');

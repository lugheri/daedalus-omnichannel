import type { CursorPage, PageRequest } from '../../../../shared/application/pagination';
import type { Message } from '../../domain/message.entity';

/** Toda operação é restrita ao tenant da operação atual (TenantContext). */
export interface MessageRepository {
  save(message: Message): Promise<void>;
  findById(id: string): Promise<Message | null>;
  /** Idempotência da entrada: a mensagem do provedor já foi registrada? */
  existsByExternalId(channelId: string, externalId: string): Promise<boolean>;
  /**
   * Mais recentes primeiro, pela hora de envio no provedor (não pela ordem de
   * chegada: mensagens em sequência são processadas em paralelo).
   */
  listByConversation(conversationId: string, page: PageRequest): Promise<CursorPage<Message>>;
}

export const MESSAGE_REPOSITORY = Symbol('MessageRepository');

import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../shared/application/id-generator';
import type { Conversation } from '../domain/conversation.entity';
import { ConversationDisposition } from '../domain/conversation-disposition.entity';
import { DispositionNotFoundError } from '../domain/errors/disposition-not-found.error';
import { DispositionRequiredError } from '../domain/errors/disposition-required.error';
import {
  CONVERSATION_DISPOSITION_REPOSITORY,
  type ConversationDispositionRepository,
} from './ports/conversation-disposition.repository';
import { DISPOSITION_REPOSITORY, type DispositionRepository } from './ports/disposition.repository';

export interface TabulationInput {
  dispositionId: string;
  note?: string | null;
}

/**
 * Regras de tabulação usadas por mais de um use case (tabular e resolver).
 * Não grava a conversa: quem chama salva e publica os eventos na mesma
 * transação.
 */
@Injectable()
export class ConversationTabulator {
  constructor(
    @Inject(DISPOSITION_REPOSITORY) private readonly dispositions: DispositionRepository,
    @Inject(CONVERSATION_DISPOSITION_REPOSITORY)
    private readonly history: ConversationDispositionRepository,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /** Tabula com uma tabulação ATIVA da conta e grava o registro no histórico. */
  async apply(
    conversation: Conversation,
    membershipId: string,
    input: TabulationInput,
  ): Promise<ConversationDisposition> {
    const disposition = await this.dispositions.findById(input.dispositionId);
    if (!disposition?.isActive) throw new DispositionNotFoundError();

    const record = ConversationDisposition.record(this.ids.generate(), {
      tenantId: conversation.tenantId,
      conversationId: conversation.id,
      dispositionId: disposition.id,
      note: input.note,
      membershipId,
    });
    conversation.setDisposition(disposition.id, membershipId);
    await this.history.save(record);
    return record;
  }

  /** Conta com tabulações ativas: atendimento só se resolve tabulado. */
  async assertCanResolve(conversation: Conversation): Promise<void> {
    if (conversation.dispositionId) return;
    if (await this.dispositions.hasActive()) throw new DispositionRequiredError();
  }
}

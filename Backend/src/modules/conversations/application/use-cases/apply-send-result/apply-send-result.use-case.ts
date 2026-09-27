import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import { MESSAGE_REPOSITORY, type MessageRepository } from '../../ports/message.repository';

/**
 * Resultado de um envio (evento do módulo channels): a mensagem pendente
 * vira enviada ou falha. Resultados de envios que não são de conversas (ex.:
 * mensagem de teste do canal) não acham mensagem e são ignorados.
 */
@Injectable()
export class ApplySendResultUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(result: {
    messageId: string;
    externalId: string | null;
    error: string | null;
  }): Promise<void> {
    await this.unitOfWork.run(async () => {
      const message = await this.messages.findById(result.messageId);
      if (!message || !message.applySendResult(result)) return;
      await this.messages.save(message);
      await this.events.publish(message.pullEvents());
    });
  }
}

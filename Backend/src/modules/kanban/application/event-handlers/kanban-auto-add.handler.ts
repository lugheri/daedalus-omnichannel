import { Inject, Injectable } from '@nestjs/common';
import {
  HandlesDomainEvent,
  type DeliveredEvent,
} from '../../../../shared/application/domain-event-handler';
import { EVENT_BUS, type EventBus } from '../../../../shared/application/event-bus';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { TenantCreatedEvent } from '../../../accounts';
import { LeadCapturedEvent } from '../../../contacts';
import { ConversationStartedEvent } from '../../../conversations';
import { FormSubmittedEvent } from '../../../forms';
import { AppointmentBookedEvent } from '../../../scheduling';
import type { Board } from '../../domain/board.entity';
import { DealAutoEntryTakenError } from '../../domain/errors/deal-auto-entry-taken.error';
import { BOARD_REPOSITORY, type BoardRepository } from '../ports/board.repository';
import {
  CONTACT_DIRECTORY,
  defaultDealTitle,
  type ContactDirectory,
} from '../ports/contact-directory';
import { DEAL_REPOSITORY, type DealRepository } from '../ports/deal.repository';
import { CreateDefaultBoardUseCase } from '../use-cases/boards.use-cases';
import { openOnTop } from '../use-cases/deals.use-cases';

interface DealEntryInput {
  contactId: string;
  conversationId: string | null;
  /** Ausente = o nome do contato. */
  title?: (contactName: string) => string;
  valueCents?: number | null;
}

/** Recusado pelo índice único: uma releitura basta (o vencedor já confirmou). */
const MAX_ATTEMPTS = 2;

/**
 * Entrada automática nos funis: abre um negócio na primeira etapa, a não ser
 * que o contato já tenha um em aberto naquele funil. Idempotente — evento
 * repetido não duplica (a releitura acha o negócio). Sob concorrência, quem
 * garante é o banco: índice único parcial `deals_auto_entry_open_key`.
 *
 * Sem dedup pelo `eventId` de propósito: a duplicata que importa vem de
 * eventos DIFERENTES do mesmo contato (conversa + lead + formulário), que o
 * `eventId` não pegaria; e a repetição do mesmo evento já cai na releitura.
 */
@Injectable()
export class DealEntry {
  constructor(
    @Inject(DEAL_REPOSITORY) private readonly deals: DealRepository,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(EVENT_BUS) private readonly events: EventBus,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  /**
   * Com `conversationId`: se o negócio em aberto do contato ainda não tem
   * conversa (ex.: lead do formulário que agora chamou no WhatsApp), ela é
   * ligada a ele em vez de abrir outro.
   */
  async enter(tenantId: string, board: Board, input: DealEntryInput): Promise<void> {
    // Dois eventos do mesmo contato processados juntos (a fila roda em
    // concorrência) leem "não tem negócio" ao mesmo tempo; o índice único
    // parcial do banco recusa o segundo, cuja transação é desfeita inteira.
    // Na segunda tentativa a leitura já vê o negócio do vencedor — e liga a
    // conversa a ele, se for o caso. Recusado de novo = já existe.
    for (let attempt = 1; ; attempt++) {
      try {
        await this.unitOfWork.run(() => this.enterOnce(tenantId, board, input));
        return;
      } catch (error) {
        if (!(error instanceof DealAutoEntryTakenError)) throw error;
        if (attempt >= MAX_ATTEMPTS) return;
      }
    }
  }

  private async enterOnce(tenantId: string, board: Board, input: DealEntryInput): Promise<void> {
    const existing = await this.deals.findOpenOnBoard(board.id, input.contactId);
    if (existing) {
      if (input.conversationId && !existing.conversationId) {
        existing.linkConversation(input.conversationId);
        await this.deals.save(existing);
        await this.events.publish(existing.pullEvents());
      }
      return;
    }
    const contact = await this.contacts.findById(input.contactId);
    if (!contact) return;
    const deal = await openOnTop(this.deals, this.ids, {
      tenantId,
      board,
      columnId: board.firstColumn.id,
      contactId: contact.id,
      conversationId: input.conversationId,
      title: (input.title ?? ((name) => name))(defaultDealTitle(contact)),
      valueCents: input.valueCents ?? null,
      ownerId: null,
      by: null,
      autoEntry: true,
    });
    await this.events.publish(deal.pullEvents());
  }
}

/** Conversa nova entra nos funis que a aceitam (todas, ou as da equipe dela). */
@Injectable()
export class KanbanConversationEntryHandler {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository,
    private readonly entry: DealEntry,
  ) {}

  @HandlesDomainEvent(ConversationStartedEvent)
  async handle(event: DeliveredEvent<ConversationStartedEvent>): Promise<void> {
    for (const board of await this.boards.listAcceptingNewConversations(event.teamId)) {
      await this.entry.enter(event.tenantId, board, {
        contactId: event.contactId,
        conversationId: event.aggregateId,
      });
    }
  }
}

/** Lead do formulário do site entra nos funis que recebem leads. */
@Injectable()
export class KanbanLeadEntryHandler {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository,
    private readonly entry: DealEntry,
  ) {}

  @HandlesDomainEvent(LeadCapturedEvent)
  async handle(event: DeliveredEvent<LeadCapturedEvent>): Promise<void> {
    for (const board of await this.boards.listAcceptingLeads()) {
      await this.entry.enter(event.tenantId, board, {
        contactId: event.aggregateId,
        conversationId: null,
      });
    }
  }
}

/**
 * Formulário do site enviado: entra nos funis que recebem leads. Solicitação
 * de serviço vira "Corte — Ana", com o preço do serviço como valor.
 */
@Injectable()
export class KanbanFormEntryHandler {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository,
    private readonly entry: DealEntry,
  ) {}

  @HandlesDomainEvent(FormSubmittedEvent)
  async handle(event: DeliveredEvent<FormSubmittedEvent>): Promise<void> {
    const { service } = event;
    for (const board of await this.boards.listAcceptingLeads()) {
      await this.entry.enter(event.tenantId, board, {
        contactId: event.contactId,
        conversationId: null,
        title: service ? (name) => `${service.name} — ${name}`.slice(0, 120) : undefined,
        valueCents: service?.priceCents ?? null,
      });
    }
  }
}

/**
 * Horário marcado PELO SITE: entra nos funis que recebem leads, como o
 * formulário de serviço ("Corte — Ana", com o preço). Marcado pelo painel não
 * (é a equipe atendendo quem já está em contato).
 */
@Injectable()
export class KanbanBookingEntryHandler {
  constructor(
    @Inject(BOARD_REPOSITORY) private readonly boards: BoardRepository,
    private readonly entry: DealEntry,
  ) {}

  @HandlesDomainEvent(AppointmentBookedEvent)
  async handle(event: DeliveredEvent<AppointmentBookedEvent>): Promise<void> {
    if (event.source !== 'site') return;
    const { service } = event;
    for (const board of await this.boards.listAcceptingLeads()) {
      await this.entry.enter(event.tenantId, board, {
        contactId: event.contactId,
        conversationId: null,
        title: (name) => `${service.name} — ${name}`.slice(0, 120),
        valueCents: service.priceCents,
      });
    }
  }
}

/** Conta nova já nasce com o funil padrão. */
@Injectable()
export class KanbanDefaultBoardHandler {
  constructor(private readonly createDefault: CreateDefaultBoardUseCase) {}

  @HandlesDomainEvent(TenantCreatedEvent)
  async handle(): Promise<void> {
    await this.createDefault.execute();
  }
}

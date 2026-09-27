import { Inject, Injectable } from '@nestjs/common';
import { EVENT_BUS, type EventBus } from '../../../../../shared/application/event-bus';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../../shared/application/unit-of-work';
import type { Conversation } from '../../../domain/conversation.entity';
import { InvalidAssigneeError } from '../../../domain/errors/invalid-assignee.error';
import { InvalidTeamError } from '../../../domain/errors/invalid-team.error';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/conversation.repository';
import { MEMBER_ACCESS, type MemberAccess } from '../../ports/member-access';
import { TEAM_DIRECTORY, type TeamDirectory } from '../../ports/team-directory';
import { VisibleConversations } from '../../visible-conversations';

abstract class ChangesConversation {
  constructor(
    protected readonly conversations: ConversationRepository,
    protected readonly events: EventBus,
    protected readonly unitOfWork: UnitOfWork,
  ) {}

  protected async persist(conversation: Conversation): Promise<void> {
    await this.unitOfWork.run(async () => {
      await this.conversations.save(conversation);
      await this.events.publish(conversation.pullEvents());
    });
  }
}

/** "Assumir": o membro pega para si uma conversa sem responsável que ele vê. */
@Injectable()
export class ClaimConversationUseCase extends ChangesConversation {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) conversations: ConversationRepository,
    @Inject(EVENT_BUS) events: EventBus,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    private readonly visible: VisibleConversations,
  ) {
    super(conversations, events, unitOfWork);
  }

  async execute(conversationId: string): Promise<void> {
    const { conversation, member } = await this.visible.load(conversationId);
    conversation.claim(member.membershipId);
    await this.persist(conversation);
  }
}

/**
 * Transferência (exige `conversations:assign`): para uma equipe e/ou uma
 * pessoa. Campo ausente = não muda; `null` = tira (fila geral / sem
 * responsável). Mudar só a equipe devolve a conversa para a fila dela.
 */
@Injectable()
export class TransferConversationUseCase extends ChangesConversation {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) conversations: ConversationRepository,
    @Inject(EVENT_BUS) events: EventBus,
    @Inject(UNIT_OF_WORK) unitOfWork: UnitOfWork,
    @Inject(TEAM_DIRECTORY) private readonly teams: TeamDirectory,
    @Inject(MEMBER_ACCESS) private readonly members: MemberAccess,
    private readonly visible: VisibleConversations,
  ) {
    super(conversations, events, unitOfWork);
  }

  async execute(input: {
    conversationId: string;
    teamId?: string | null;
    assigneeId?: string | null;
  }): Promise<void> {
    const { conversation } = await this.visible.load(input.conversationId);

    if (input.teamId !== undefined) {
      if (input.teamId && !(await this.teams.exists(input.teamId))) throw new InvalidTeamError();
      conversation.moveToTeam(input.teamId);
      // Trocou de equipe sem dizer para quem: vai para a fila da equipe nova.
      if (input.assigneeId === undefined) conversation.assign(null);
    }
    if (input.assigneeId !== undefined) {
      if (input.assigneeId) {
        const [active] = await this.members.activeMemberIds([input.assigneeId]);
        if (!active) throw new InvalidAssigneeError();
      }
      conversation.assign(input.assigneeId);
    }
    await this.persist(conversation);
  }
}

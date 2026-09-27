import { DomainEvent } from '../../../../shared/domain/domain-event';

/**
 * Equipe excluída. Canais e conversas guardam o id dela: cada módulo limpa o
 * seu (canal sem equipe; conversa volta para a fila geral).
 */
export class TeamDeletedEvent extends DomainEvent {
  static readonly eventName = 'team.deleted.v1';
  readonly eventName = TeamDeletedEvent.eventName;

  constructor(
    teamId: string,
    readonly tenantId: string,
  ) {
    super(teamId);
  }
}

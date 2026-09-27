import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidTeamNameError } from './errors/invalid-team-name.error';
import { TeamDeletedEvent } from './events/team-deleted.event';

export interface TeamProps {
  tenantId: string;
  name: string;
  /** Vínculos (memberships) que fazem parte da equipe. */
  memberIds: string[];
  createdAt: Date;
}

/**
 * Grupo de atendentes (ex.: Vendas, Suporte). Define SOBRE QUAIS conversas
 * um membro com `conversations:view:team` atua — o cargo define o que ele pode
 * fazer (ADR 0003).
 */
export class Team extends AggregateRoot<TeamProps> {
  static create(id: string, input: { tenantId: string; name: string }): Team {
    return new Team(id, {
      tenantId: input.tenantId,
      name: validName(input.name),
      memberIds: [],
      createdAt: new Date(),
    });
  }

  static restore(id: string, props: TeamProps): Team {
    return new Team(id, props);
  }

  rename(name: string): void {
    this.props.name = validName(name);
  }

  /** Substitui os membros. Quem são membros válidos da conta, o use case confere. */
  setMembers(memberIds: string[]): void {
    this.props.memberIds = [...new Set(memberIds)];
  }

  delete(): void {
    this.addEvent(new TeamDeletedEvent(this.id, this.props.tenantId));
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get name() {
    return this.props.name;
  }
  get memberIds(): readonly string[] {
    return this.props.memberIds;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}

function validName(raw: string): string {
  const name = raw.trim();
  if (name.length < 1 || name.length > 60) throw new InvalidTeamNameError();
  return name;
}

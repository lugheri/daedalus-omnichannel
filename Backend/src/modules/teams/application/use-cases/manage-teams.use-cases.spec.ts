import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  RecordingEventBus,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { InvalidTeamMembersError } from '../../domain/errors/invalid-team-members.error';
import { InvalidTeamNameError } from '../../domain/errors/invalid-team-name.error';
import { TeamNameTakenError } from '../../domain/errors/team-name-taken.error';
import { TeamNotFoundError } from '../../domain/errors/team-not-found.error';
import { TeamDeletedEvent } from '../../domain/events/team-deleted.event';
import { FakeMemberDirectory, InMemoryTeamRepository } from '../../testing/fakes';
import { TeamsFacade } from '../teams.facade';
import {
  CreateTeamUseCase,
  DeleteTeamUseCase,
  ListTeamsUseCase,
  RenameTeamUseCase,
  SetTeamMembersUseCase,
} from './manage-teams.use-cases';

describe('Teams', () => {
  let tenant: FakeTenantContext;
  let teams: InMemoryTeamRepository;
  let events: RecordingEventBus;

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    teams = new InMemoryTeamRepository(tenant);
    events = new RecordingEventBus();
  });

  const ids = new SequentialIdGenerator();
  const create = (name: string) => new CreateTeamUseCase(teams, tenant, ids).execute({ name });
  const setMembers = (teamId: string, memberIds: string[]) =>
    new SetTeamMembersUseCase(teams, new FakeMemberDirectory(['ana', 'bia'])).execute({
      teamId,
      memberIds,
    });

  it('creates, renames and lists teams by name', async () => {
    const sales = await create('  Vendas ');
    await create('Atendimento');
    await new RenameTeamUseCase(teams).execute({ teamId: sales.id, name: 'Comercial' });

    const names = (await new ListTeamsUseCase(teams).execute()).map((t) => t.name);
    expect(names).toEqual(['Atendimento', 'Comercial']);
  });

  it('validates the name and refuses duplicates in the same account', async () => {
    await expect(create('   ')).rejects.toThrow(InvalidTeamNameError);
    await create('Vendas');
    await expect(create('Vendas')).rejects.toThrow(TeamNameTakenError);

    tenant.switchTo('tenant-b');
    await expect(create('Vendas')).resolves.toBeDefined();
  });

  it('members must be active members of the account', async () => {
    const team = await create('Vendas');

    await expect(setMembers(team.id, ['ana', 'ghost'])).rejects.toThrow(InvalidTeamMembersError);
    await setMembers(team.id, ['ana', 'bia', 'ana']);

    expect(team.memberIds).toEqual(['ana', 'bia']);
    expect(await new TeamsFacade(teams).teamIdsOf('bia')).toEqual([team.id]);
  });

  it('deleting announces it, so channels and conversations can release the team', async () => {
    const team = await create('Vendas');

    await new DeleteTeamUseCase(teams, events, new ImmediateUnitOfWork()).execute(team.id);

    expect(await teams.findById(team.id)).toBeNull();
    expect(events.published).toEqual([expect.any(TeamDeletedEvent)]);
  });

  it("does not reveal other accounts' teams", async () => {
    const team = await create('Vendas');
    tenant.switchTo('tenant-b');

    await expect(setMembers(team.id, ['ana'])).rejects.toThrow(TeamNotFoundError);
    expect(await new TeamsFacade(teams).exists(team.id)).toBe(false);
  });
});

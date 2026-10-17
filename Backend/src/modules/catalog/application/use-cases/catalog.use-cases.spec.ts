import {
  FakeTenantContext,
  ImmediateUnitOfWork,
  SequentialIdGenerator,
} from '../../../../shared/testing/fakes';
import { CatalogConflictError } from '../../domain/errors/catalog-conflict.error';
import { CatalogItemNotFoundError } from '../../domain/errors/catalog-item-not-found.error';
import { InvalidCatalogItemError } from '../../domain/errors/invalid-catalog-item.error';
import type { OfferingDetails } from '../../domain/offering.entity';
import { CatalogFacade } from '../catalog.facade';
import {
  FakeMemberDirectory,
  InMemoryOfferingRepository,
  InMemoryProfessionalRepository,
} from '../../testing/fakes';
import {
  CreateOfferingUseCase,
  CreateProfessionalUseCase,
  DeleteOfferingUseCase,
  DeleteProfessionalUseCase,
  ListOfferingsUseCase,
  ListProfessionalsUseCase,
  ProfessionalReferences,
  UpdateOfferingUseCase,
  UpdateProfessionalUseCase,
} from './catalog.use-cases';

describe('Catalog', () => {
  let tenant: FakeTenantContext;
  let offerings: InMemoryOfferingRepository;
  let professionals: InMemoryProfessionalRepository;
  const ids = new SequentialIdGenerator();

  beforeEach(() => {
    tenant = new FakeTenantContext('tenant-a');
    offerings = new InMemoryOfferingRepository(tenant);
    professionals = new InMemoryProfessionalRepository(tenant);
  });

  const service = (overrides: Partial<OfferingDetails> = {}) =>
    new CreateOfferingUseCase(offerings, tenant, ids).execute({
      name: 'Corte',
      description: null,
      durationMinutes: 30,
      priceCents: 5000,
      showOnSite: true,
      ...overrides,
    });

  const references = () => new ProfessionalReferences(offerings, new FakeMemberDirectory(['ana']));
  const professional = (input: { name?: string; offeringIds?: string[]; membershipId?: string }) =>
    new CreateProfessionalUseCase(professionals, references(), tenant, ids).execute({
      name: input.name ?? 'Bia',
      title: 'Cabeleireira',
      bio: null,
      membershipId: input.membershipId ?? null,
      showOnSite: true,
      offeringIds: input.offeringIds ?? [],
    });

  describe('services', () => {
    it('creates with trimmed text, lists by name and edits only what was sent', async () => {
      const cut = await service({ name: '  Corte ', description: '   ' });
      await service({ name: 'Barba', priceCents: null });
      expect(cut.name).toBe('Corte');
      expect(cut.description).toBeNull();
      expect(cut.active).toBe(true);

      await new UpdateOfferingUseCase(offerings).execute(cut.id, {
        durationMinutes: 45,
        active: false,
      });

      const list = await new ListOfferingsUseCase(offerings).execute();
      expect(list.map((o) => o.name)).toEqual(['Barba', 'Corte']);
      expect(list[1]).toMatchObject({ durationMinutes: 45, priceCents: 5000, active: false });
      expect(list[0].priceCents).toBeNull(); // sob consulta
    });

    it.each([
      [{ name: ' ' }, 'SERVICE_INVALID_NAME'],
      [{ name: 'x'.repeat(81) }, 'SERVICE_INVALID_NAME'],
      [{ description: 'x'.repeat(1001) }, 'SERVICE_INVALID_DESCRIPTION'],
      [{ durationMinutes: 4 }, 'SERVICE_INVALID_DURATION'],
      [{ durationMinutes: 721 }, 'SERVICE_INVALID_DURATION'],
      [{ durationMinutes: 30.5 }, 'SERVICE_INVALID_DURATION'],
      [{ priceCents: -1 }, 'SERVICE_INVALID_PRICE'],
      [{ priceCents: 10_000_001 }, 'SERVICE_INVALID_PRICE'],
      [{ priceCents: 10.5 }, 'SERVICE_INVALID_PRICE'],
    ])('refuses %j (%s)', async (overrides, code) => {
      await expect(service(overrides)).rejects.toMatchObject({ code });
    });

    it('an invalid edit changes nothing', async () => {
      const cut = await service();
      await expect(
        new UpdateOfferingUseCase(offerings).execute(cut.id, { name: 'Novo', durationMinutes: 0 }),
      ).rejects.toThrow(InvalidCatalogItemError);
      expect((await offerings.findById(cut.id))?.name).toBe('Corte');
    });

    it('the site only sees active services marked to show there', async () => {
      const shown = await service({ name: 'Corte' });
      const hidden = await service({ name: 'Interno', showOnSite: false });
      const paused = await service({ name: 'Pausado' });
      await new UpdateOfferingUseCase(offerings).execute(paused.id, { active: false });
      const facade = new CatalogFacade(offerings);

      expect(await facade.siteService(shown.id)).toEqual({
        id: shown.id,
        name: 'Corte',
        priceCents: 5000,
      });
      expect(await facade.siteService(hidden.id)).toBeNull();
      expect(await facade.siteService(paused.id)).toBeNull();
      tenant.switchTo('tenant-b');
      expect(await facade.siteService(shown.id)).toBeNull();
    });

    it('names are unique per account', async () => {
      await service();
      await expect(service()).rejects.toThrow(CatalogConflictError);
      tenant.switchTo('tenant-b');
      await expect(service()).resolves.toBeDefined();
    });

    it('deleting a service takes it out of who did it', async () => {
      const cut = await service();
      const beard = await service({ name: 'Barba' });
      const bia = await professional({ offeringIds: [cut.id, beard.id] });

      await new DeleteOfferingUseCase(offerings, professionals, new ImmediateUnitOfWork()).execute(
        cut.id,
      );

      expect(await offerings.findById(cut.id)).toBeNull();
      expect((await professionals.findById(bia.id))?.offeringIds).toEqual([beard.id]);
    });
  });

  describe('professionals', () => {
    it('creates without a login, with the services they do, and lists by name', async () => {
      const cut = await service();
      await professional({ name: 'Carla' });
      const bia = await professional({ name: 'Bia', offeringIds: [cut.id, cut.id] });

      expect(bia.membershipId).toBeNull();
      expect(bia.offeringIds).toEqual([cut.id]);
      const names = (await new ListProfessionalsUseCase(professionals).execute()).map(
        (p) => p.name,
      );
      expect(names).toEqual(['Bia', 'Carla']);
    });

    it('services must exist in this account', async () => {
      tenant.switchTo('tenant-b');
      const otherAccount = await service();
      tenant.switchTo('tenant-a');

      await expect(professional({ offeringIds: [otherAccount.id] })).rejects.toMatchObject({
        code: 'PROFESSIONAL_UNKNOWN_SERVICES',
      });
    });

    it('a linked member must be active, and is at most one professional', async () => {
      await expect(professional({ membershipId: 'inactive' })).rejects.toMatchObject({
        code: 'PROFESSIONAL_INVALID_MEMBER',
      });
      await professional({ name: 'Ana', membershipId: 'ana' });
      await expect(professional({ name: 'Ana 2', membershipId: 'ana' })).rejects.toMatchObject({
        code: 'PROFESSIONAL_MEMBER_TAKEN',
      });
    });

    it('editing other fields does not re-check a member that was disabled later', async () => {
      const ana = await professional({ name: 'Ana', membershipId: 'ana' });
      const update = (changes: object) =>
        new UpdateProfessionalUseCase(
          professionals,
          new ProfessionalReferences(offerings, new FakeMemberDirectory([])), // "ana" saiu
        ).execute(ana.id, changes);

      await expect(update({ title: 'Gerente' })).resolves.toMatchObject({ title: 'Gerente' });
      await expect(update({ membershipId: 'outro' })).rejects.toMatchObject({
        code: 'PROFESSIONAL_INVALID_MEMBER',
      });
      await expect(update({ membershipId: null })).resolves.toMatchObject({ membershipId: null });
    });

    it('updates services and status; deletes', async () => {
      const cut = await service();
      const bia = await professional({});
      const update = new UpdateProfessionalUseCase(professionals, references());

      await update.execute(bia.id, { offeringIds: [cut.id], active: false, bio: '  Desde 2010 ' });
      expect(await professionals.findById(bia.id)).toMatchObject({
        offeringIds: [cut.id],
        active: false,
        bio: 'Desde 2010',
      });

      await new DeleteProfessionalUseCase(professionals).execute(bia.id);
      await expect(update.execute(bia.id, { name: 'x' })).rejects.toThrow(CatalogItemNotFoundError);
    });

    it('another account does not see them', async () => {
      const bia = await professional({});
      tenant.switchTo('tenant-b');
      expect(await new ListProfessionalsUseCase(professionals).execute()).toEqual([]);
      await expect(new DeleteProfessionalUseCase(professionals).execute(bia.id)).rejects.toThrow(
        CatalogItemNotFoundError,
      );
    });
  });
});

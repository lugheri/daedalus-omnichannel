import { Inject, Injectable } from '@nestjs/common';
import { ACTOR_CONTEXT, type ActorContext } from '../../../../shared/application/actor-context';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { JOB_QUEUE, type JobQueue } from '../../../../shared/application/job-queue';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { Campaign, type CampaignAudience } from '../../domain/campaign.entity';
import { CampaignNotFoundError } from '../../domain/errors/campaign-not-found.error';
import { InvalidCampaignError } from '../../domain/errors/invalid-campaign.error';
import { MessagingNotConfiguredError } from '../../domain/errors/messaging-not-configured.error';
import type { MessagingChannel } from '../../domain/messaging-provider.entity';
import type { OutboundMessage, OutboundStatus } from '../../domain/outbound-message.entity';
import { MaterializeCampaignJob } from '../messaging-jobs';
import { CAMPAIGN_REPOSITORY, type CampaignRepository } from '../ports/campaign.repository';
import {
  CONTACT_DIRECTORY,
  type ContactDirectory,
  type MessagingContact,
} from '../ports/contact-directory';
import {
  MESSAGING_PROVIDER_REPOSITORY,
  type MessagingProviderRepository,
} from '../ports/messaging-provider.repository';
import {
  OUTBOUND_MESSAGE_REPOSITORY,
  type OutboundMessageRepository,
} from '../ports/outbound-message.repository';

/*
 * Campanhas (`campaigns:manage`, checado na rota). O envio em si é no
 * worker (MaterializeCampaignJob); aqui só criar, editar, agendar, cancelar
 * e ver o resultado.
 */

async function campaignOf(repo: CampaignRepository, id: string): Promise<Campaign> {
  const campaign = await repo.findById(id);
  if (!campaign) throw new CampaignNotFoundError();
  return campaign;
}

@Injectable()
export class ListCampaignsUseCase {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository) {}

  execute(page: { cursor?: string; limit: number }) {
    return this.campaigns.list(page);
  }
}

export interface CampaignReport {
  campaign: Campaign;
  /** Mensagens por status (só as que foram para a fila). */
  counts: Record<OutboundStatus, number>;
}

@Injectable()
export class GetCampaignUseCase {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository,
    @Inject(OUTBOUND_MESSAGE_REPOSITORY) private readonly messages: OutboundMessageRepository,
  ) {}

  async execute(id: string): Promise<CampaignReport> {
    const campaign = await campaignOf(this.campaigns, id);
    return { campaign, counts: await this.messages.countByStatus(campaign.id) };
  }
}

export interface CampaignInput {
  name: string;
  subject?: string | null;
  body: string;
  audience: CampaignAudience;
}

@Injectable()
export class CreateCampaignUseCase {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: CampaignInput & { channel: MessagingChannel }): Promise<Campaign> {
    const campaign = Campaign.draft(this.ids.generate(), {
      ...input,
      tenantId: this.tenant.tenantId,
      createdByMembershipId: this.actors.actor.membershipId,
    });
    await this.campaigns.save(campaign);
    return campaign;
  }
}

@Injectable()
export class UpdateCampaignUseCase {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository) {}

  /** Campo ausente = não muda. Só rascunho ou agendada. */
  async execute(id: string, input: Partial<CampaignInput>): Promise<Campaign> {
    const campaign = await campaignOf(this.campaigns, id);
    campaign.edit(input);
    await this.campaigns.save(campaign);
    return campaign;
  }
}

/**
 * Agendar (`at`) ou enviar agora (`at` null). Exige o provedor do canal
 * configurado — senão a campanha começaria e falharia inteira.
 */
@Injectable()
export class ScheduleCampaignUseCase {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository,
    @Inject(MESSAGING_PROVIDER_REPOSITORY) private readonly providers: MessagingProviderRepository,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async execute(id: string, at: Date | null): Promise<Campaign> {
    const campaign = await campaignOf(this.campaigns, id);
    if (!(await this.providers.findByChannel(campaign.channel))) {
      throw new MessagingNotConfiguredError();
    }
    campaign.schedule(at);
    await this.campaigns.save(campaign);
    if (campaign.status === 'sending') {
      await this.jobs.add(
        MaterializeCampaignJob,
        { campaignId: campaign.id },
        { jobId: `campaign:${campaign.id}` },
      );
    }
    return campaign;
  }
}

@Injectable()
export class UnscheduleCampaignUseCase {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository) {}

  async execute(id: string): Promise<Campaign> {
    const campaign = await campaignOf(this.campaigns, id);
    campaign.unschedule();
    await this.campaigns.save(campaign);
    return campaign;
  }
}

/** Para o que ainda não saiu: as mensagens na fila viram "falhou: cancelada" na entrega. */
@Injectable()
export class CancelCampaignUseCase {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository) {}

  async execute(id: string): Promise<Campaign> {
    const campaign = await campaignOf(this.campaigns, id);
    campaign.cancel();
    await this.campaigns.save(campaign);
    return campaign;
  }
}

/** Só rascunho: depois de agendada/enviada, o histórico fica. */
@Injectable()
export class DeleteCampaignUseCase {
  constructor(@Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository) {}

  async execute(id: string): Promise<void> {
    const campaign = await campaignOf(this.campaigns, id);
    if (campaign.status !== 'draft') throw new InvalidCampaignError('CAMPAIGN_NOT_EDITABLE');
    await this.campaigns.delete(campaign);
  }
}

/** Quantos contatos o filtro pega, e quantos têm endereço no canal. */
@Injectable()
export class PreviewAudienceUseCase {
  constructor(@Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory) {}

  async execute(
    channel: MessagingChannel,
    audience: CampaignAudience,
  ): Promise<{ total: number; reachable: number }> {
    const count = await this.contacts.countAudience(audience);
    return {
      total: count.total,
      reachable: channel === 'email' ? count.withEmail : count.withPhone,
    };
  }
}

export interface Recipient {
  message: OutboundMessage;
  contact: MessagingContact | null;
}

/** Destinatários da campanha, com o status de cada um. */
@Injectable()
export class ListCampaignRecipientsUseCase {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository,
    @Inject(OUTBOUND_MESSAGE_REPOSITORY) private readonly messages: OutboundMessageRepository,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
  ) {}

  async execute(
    id: string,
    page: { cursor?: string; limit: number; status?: OutboundStatus },
  ): Promise<{ items: Recipient[]; nextCursor: string | null }> {
    const campaign = await campaignOf(this.campaigns, id);
    const result = await this.messages.listByCampaign(campaign.id, page);
    const contacts = new Map(
      (await this.contacts.findByIds(result.items.map((m) => m.contactId))).map((c) => [c.id, c]),
    );
    return {
      items: result.items.map((message) => ({
        message,
        contact: contacts.get(message.contactId) ?? null,
      })),
      nextCursor: result.nextCursor,
    };
  }
}

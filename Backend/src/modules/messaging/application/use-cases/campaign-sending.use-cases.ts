import { Inject, Injectable, Logger } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { JOB_QUEUE, type JobQueue } from '../../../../shared/application/job-queue';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { UNIT_OF_WORK, type UnitOfWork } from '../../../../shared/application/unit-of-work';
import { renderTemplate } from '../../../../shared/domain/message-template';
import {
  MAX_CAMPAIGN_SMS_BODY,
  SMS_OPT_OUT_FOOTER,
  type Campaign,
} from '../../domain/campaign.entity';
import { MAX_EMAIL_BODY, MAX_SUBJECT, OutboundMessage } from '../../domain/outbound-message.entity';
import {
  CAMPAIGN_RATE_PER_SECOND,
  DeliverOutboundJob,
  MaterializeCampaignJob,
} from '../messaging-jobs';
import { CAMPAIGN_REPOSITORY, type CampaignRepository } from '../ports/campaign.repository';
import { CONTACT_DIRECTORY, type ContactDirectory } from '../ports/contact-directory';
import { OPT_OUT_REPOSITORY, type OptOutRepository } from '../ports/opt-out.repository';
import {
  OUTBOUND_MESSAGE_REPOSITORY,
  type OutboundMessageRepository,
} from '../ports/outbound-message.repository';
import { addressOf } from './contact-messages.use-cases';

/** Contatos por lote da montagem do público. */
export const AUDIENCE_BATCH = 500;

/**
 * Monta o público da campanha (worker), em lotes: cada contato vira uma
 * mensagem na fila de entrega, com o texto já personalizado. Pula quem não
 * tem endereço no canal ou se descadastrou (e conta). As entregas saem no
 * ritmo do canal (atraso crescente em cada job).
 *
 * Retomável: o cursor e os contadores são gravados junto com cada lote; e um
 * contato nunca entra duas vezes na mesma campanha (verificado aqui e
 * garantido pelo banco).
 */
@Injectable()
export class MaterializeCampaignUseCase {
  private readonly logger = new Logger(MaterializeCampaignUseCase.name);

  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository,
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(OPT_OUT_REPOSITORY) private readonly optOuts: OptOutRepository,
    @Inject(OUTBOUND_MESSAGE_REPOSITORY) private readonly messages: OutboundMessageRepository,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(campaignId: string): Promise<void> {
    let campaign = await this.campaigns.findById(campaignId);
    if (!campaign || campaign.status !== 'sending') return;

    // Retomada depois de uma queda: o último lote pode ter sido gravado sem
    // ir para a fila. Reenfileira o que está na fila (job com o mesmo id é ignorado).
    if (campaign.audienceCursor !== null) {
      for (const messageId of await this.messages.queuedIdsInCampaign(campaign.id)) {
        await this.jobs.add(DeliverOutboundJob, { messageId }, { jobId: `deliver:${messageId}` });
      }
    }

    let cursor = campaign.audienceCursor ?? undefined;
    for (;;) {
      // A campanha pode ter sido cancelada no meio da montagem.
      campaign = await this.campaigns.findById(campaignId);
      if (!campaign || campaign.status !== 'sending') return;

      const page = await this.contacts.audiencePage(campaign.audience, {
        cursor,
        limit: AUDIENCE_BATCH,
      });
      await this.processBatch(campaign, page.items, page.nextCursor);
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    campaign.finish();
    await this.campaigns.save(campaign);
    this.logger.log(
      `Campanha ${campaign.id}: ${campaign.queuedCount} na fila, ${campaign.skippedNoAddress} sem endereço, ${campaign.skippedOptedOut} descadastrados`,
    );
  }

  private async processBatch(
    campaign: Campaign,
    contacts: { id: string; name: string | null; email: string | null; phone: string | null }[],
    nextCursor: string | null,
  ): Promise<void> {
    const alreadyIn = await this.messages.contactsInCampaign(
      campaign.id,
      contacts.map((c) => c.id),
    );
    const withAddress = contacts
      .filter((c) => !alreadyIn.has(c.id))
      .map((contact) => ({ contact, to: addressOf(contact, campaign.channel) }));
    const noAddress = withAddress.filter((c) => !c.to).length;
    const optedOut = new Set(
      (
        await this.optOuts.listFor(
          withAddress.flatMap(({ to }) => (to ? [{ channel: campaign.channel, address: to }] : [])),
        )
      ).map((o) => o.address),
    );

    const messages = withAddress.flatMap(({ contact, to }) => {
      if (!to || optedOut.has(to)) return [];
      // Personalizado; cortado no limite (um nome longo não pode derrubar o lote).
      const body = renderTemplate(campaign.body, { name: contact.name }).slice(
        0,
        campaign.channel === 'sms' ? MAX_CAMPAIGN_SMS_BODY : MAX_EMAIL_BODY,
      );
      return [
        OutboundMessage.compose(this.ids.generate(), {
          tenantId: campaign.tenantId,
          channel: campaign.channel,
          contactId: contact.id,
          to,
          subject: campaign.subject
            ? renderTemplate(campaign.subject, { name: contact.name }).slice(0, MAX_SUBJECT)
            : null,
          body: campaign.channel === 'sms' ? `${body}\n\n${SMS_OPT_OUT_FOOTER}` : body,
          sentByMembershipId: null,
          campaignId: campaign.id,
        }),
      ];
    });

    const startIndex = campaign.queuedCount;
    campaign.recordBatch({
      cursor: nextCursor,
      queued: messages.length,
      skippedNoAddress: noAddress,
      skippedOptedOut: withAddress.filter(({ to }) => to && optedOut.has(to)).length,
    });
    await this.unitOfWork.run(async () => {
      await this.messages.saveMany(messages);
      await this.campaigns.save(campaign);
    });

    // No ritmo do canal: a n-ésima mensagem da campanha sai n / taxa segundos depois.
    const rate = CAMPAIGN_RATE_PER_SECOND[campaign.channel];
    for (const [i, message] of messages.entries()) {
      await this.jobs.add(
        DeliverOutboundJob,
        { messageId: message.id },
        {
          jobId: `deliver:${message.id}`,
          delayMs: Math.floor(((startIndex + i) * 1000) / rate),
        },
      );
    }
  }
}

/**
 * Varredura (a cada minuto, no worker): campanhas agendadas que venceram,
 * de todas as contas. Cada uma começa no tenant dela e vai para a montagem.
 */
@Injectable()
export class StartDueCampaignsUseCase {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY) private readonly campaigns: CampaignRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(JOB_QUEUE) private readonly jobs: JobQueue,
  ) {}

  async execute(now = new Date()): Promise<number> {
    const due = await this.campaigns.listDueAllTenants(now);
    for (const { id, tenantId } of due) {
      this.tenant.enter(tenantId);
      const campaign = await this.campaigns.findById(id);
      if (!campaign || campaign.status !== 'scheduled') continue;
      campaign.start(now);
      await this.campaigns.save(campaign);
      await this.jobs.add(MaterializeCampaignJob, { campaignId: id }, { jobId: `campaign:${id}` });
    }
    return due.length;
  }
}

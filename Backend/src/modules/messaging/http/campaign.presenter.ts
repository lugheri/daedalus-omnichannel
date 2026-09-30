import type { CampaignReport, Recipient } from '../application/use-cases/campaigns.use-cases';
import type { Campaign } from '../domain/campaign.entity';

export const CampaignPresenter = {
  toHttp: (campaign: Campaign) => ({
    id: campaign.id,
    name: campaign.name,
    channel: campaign.channel,
    subject: campaign.subject,
    body: campaign.body,
    audience: campaign.audience,
    status: campaign.status,
    scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
    startedAt: campaign.startedAt?.toISOString() ?? null,
    finishedAt: campaign.finishedAt?.toISOString() ?? null,
    queuedCount: campaign.queuedCount,
    skippedNoAddress: campaign.skippedNoAddress,
    skippedOptedOut: campaign.skippedOptedOut,
    createdByMembershipId: campaign.createdByMembershipId,
    createdAt: campaign.createdAt.toISOString(),
  }),
  report: ({ campaign, counts }: CampaignReport) => ({
    ...CampaignPresenter.toHttp(campaign),
    counts,
  }),
  recipient: ({ message, contact }: Recipient) => ({
    messageId: message.id,
    contactId: message.contactId,
    contactName: contact?.name ?? null,
    to: message.to,
    status: message.status,
    error: message.error,
    sentAt: message.sentAt?.toISOString() ?? null,
    deliveredAt: message.deliveredAt?.toISOString() ?? null,
  }),
};

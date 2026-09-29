import type { OptOut } from '../domain/opt-out';
import type { OutboundMessage } from '../domain/outbound-message.entity';

export const OutboundMessagePresenter = {
  toHttp: (message: OutboundMessage) => ({
    id: message.id,
    channel: message.channel,
    contactId: message.contactId,
    to: message.to,
    subject: message.subject,
    body: message.body,
    status: message.status,
    error: message.error,
    sentByMembershipId: message.sentByMembershipId,
    campaignId: message.campaignId,
    createdAt: message.createdAt.toISOString(),
    sentAt: message.sentAt?.toISOString() ?? null,
    deliveredAt: message.deliveredAt?.toISOString() ?? null,
  }),
  optOut: (optOut: OptOut) => ({
    channel: optOut.channel,
    address: optOut.address,
    source: optOut.source,
    createdAt: optOut.createdAt.toISOString(),
  }),
};

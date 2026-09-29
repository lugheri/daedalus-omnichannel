import { defineJob } from '../../../shared/application/job-queue';
import type { MessagingChannel } from '../domain/messaging-provider.entity';
import type { OutboundStatus } from '../domain/outbound-message.entity';

export const MESSAGING_QUEUE = 'messaging';

/** Entregar uma mensagem da fila ao provedor. */
export const DeliverOutboundJob = defineJob<{ messageId: string }>(MESSAGING_QUEUE, 'deliver');

/** Aviso de um provedor, já conferido e traduzido (webhooks respondem rápido e enfileiram). */
export interface ProviderEvent {
  /** Nosso id da mensagem (volta nos avisos: custom_args / URL do callback). */
  messageId: string | null;
  status: Exclude<OutboundStatus, 'queued'> | null;
  error?: string | null;
  /** O próprio provedor registrou descadastro/denúncia de spam deste endereço. */
  optOut?: { channel: MessagingChannel; address: string };
}

export const ProviderEventsJob = defineJob<{ events: ProviderEvent[] }>(
  MESSAGING_QUEUE,
  'provider-events',
);

/** SMS recebido no número da Twilio (hoje só importa o "SAIR"). */
export const InboundSmsJob = defineJob<{ from: string; body: string }>(
  MESSAGING_QUEUE,
  'inbound-sms',
);

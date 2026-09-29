import type { MessagingChannel, MessagingProvider } from '../../domain/messaging-provider.entity';

/** Provedores da conta (tenant atual), no máximo um por canal. */
export interface MessagingProviderRepository {
  save(provider: MessagingProvider): Promise<void>;
  findByChannel(channel: MessagingChannel): Promise<MessagingProvider | null>;
  list(): Promise<MessagingProvider[]>;
  delete(provider: MessagingProvider): Promise<void>;
}

export const MESSAGING_PROVIDER_REPOSITORY = Symbol('MessagingProviderRepository');

import type { MessagingChannel, MessagingProvider } from '../../domain/messaging-provider.entity';

/** Provedores da conta (tenant atual), no máximo um por canal. */
export interface MessagingProviderRepository {
  save(provider: MessagingProvider): Promise<void>;
  findByChannel(channel: MessagingChannel): Promise<MessagingProvider | null>;
  list(): Promise<MessagingProvider[]>;
  delete(provider: MessagingProvider): Promise<void>;
  /**
   * Por id, SEM filtro de tenant: só para webhooks, que chegam sem sessão e
   * descobrem a conta pelo provedor (depois de conferir a assinatura dele).
   */
  findByIdAsSystem(id: string): Promise<MessagingProvider | null>;
}

export const MESSAGING_PROVIDER_REPOSITORY = Symbol('MessagingProviderRepository');

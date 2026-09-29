import type { MessagingChannel } from '../../domain/messaging-provider.entity';
import type { OptOut } from '../../domain/opt-out';

/** Descadastros (tenant atual). */
export interface OptOutRepository {
  /** Idempotente: descadastrar de novo mantém o primeiro registro. */
  add(optOut: OptOut): Promise<void>;
  isOptedOut(channel: MessagingChannel, address: string): Promise<boolean>;
  /** Dos endereços informados, os descadastrados. */
  listFor(addresses: { channel: MessagingChannel; address: string }[]): Promise<OptOut[]>;
  remove(channel: MessagingChannel, address: string): Promise<void>;
}

export const OPT_OUT_REPOSITORY = Symbol('OptOutRepository');

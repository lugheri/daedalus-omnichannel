import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import {
  MESSAGING_PROVIDER_REPOSITORY,
  type MessagingProviderRepository,
} from '../ports/messaging-provider.repository';
import { OPT_OUT_REPOSITORY, type OptOutRepository } from '../ports/opt-out.repository';
import {
  UNSUBSCRIBE_TOKENS,
  type UnsubscribeTarget,
  type UnsubscribeTokens,
} from '../ports/unsubscribe-tokens';

export interface UnsubscribePage {
  target: UnsubscribeTarget;
  /** Nome do remetente (para a página dizer de quem). */
  senderName: string;
  alreadyOptedOut: boolean;
}

/**
 * Link de descadastro (público, sem sessão). O token é assinado: diz a conta
 * e o endereço. GET só mostra a página — quem descadastra é o POST (botão da
 * página ou o "cancelar inscrição" de um clique do Gmail/Outlook), porque
 * antivírus de e-mail abrem os links sozinhos.
 */
@Injectable()
export class UnsubscribeUseCase {
  constructor(
    @Inject(UNSUBSCRIBE_TOKENS) private readonly tokens: UnsubscribeTokens,
    @Inject(OPT_OUT_REPOSITORY) private readonly optOuts: OptOutRepository,
    @Inject(MESSAGING_PROVIDER_REPOSITORY) private readonly providers: MessagingProviderRepository,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  /** null = link inválido. */
  async inspect(token: string): Promise<UnsubscribePage | null> {
    const target = this.tokens.verify(token);
    if (!target) return null;
    this.tenant.enter(target.tenantId);
    return {
      target,
      senderName: await this.senderName(),
      alreadyOptedOut: await this.optOuts.isOptedOut(target.channel, target.address),
    };
  }

  async confirm(token: string): Promise<UnsubscribePage | null> {
    const page = await this.inspect(token);
    if (!page) return null;
    await this.optOuts.add({
      ...page.target,
      source: 'unsubscribe_link',
      createdAt: new Date(),
    });
    return { ...page, alreadyOptedOut: true };
  }

  private async senderName(): Promise<string> {
    const email = await this.providers.findByChannel('email');
    return email?.settings.provider === 'sendgrid' ? email.settings.fromName : 'esta empresa';
  }
}

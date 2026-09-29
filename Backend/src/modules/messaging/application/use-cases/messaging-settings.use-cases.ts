import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../shared/application/id-generator';
import { SECRET_CIPHER, type SecretCipher } from '../../../../shared/application/secret-cipher';
import { TENANT_CONTEXT, type TenantContext } from '../../../../shared/application/tenant-context';
import { DomainError } from '../../../../shared/domain/domain-error';
import { normalizePhoneNumber } from '../../../../shared/domain/phone-number';
import { InvalidMessagingSettingsError } from '../../domain/errors/invalid-messaging-settings.error';
import { MessagingNotConfiguredError } from '../../domain/errors/messaging-not-configured.error';
import { ProviderRejectedError } from '../../domain/errors/provider-rejected.error';
import { ProviderUnavailableError } from '../../domain/errors/provider-unavailable.error';
import {
  assertValidSecret,
  MessagingProvider,
  normalizeEmail,
  type MessagingChannel,
  type ProviderSettings,
  type SealedSecret,
} from '../../domain/messaging-provider.entity';
import {
  MESSAGING_PROVIDER_REPOSITORY,
  type MessagingProviderRepository,
} from '../ports/messaging-provider.repository';
import { PROVIDER_CLIENTS, type ProviderClients } from '../ports/provider-clients';

/*
 * Configuração dos provedores de e-mail e SMS da conta (`messaging:manage`,
 * checado na rota). As credenciais são do cliente e ficam cifradas; o
 * segredo nunca volta para a tela — só os últimos 4 caracteres.
 */

@Injectable()
export class ListMessagingProvidersUseCase {
  constructor(
    @Inject(MESSAGING_PROVIDER_REPOSITORY) private readonly providers: MessagingProviderRepository,
  ) {}

  execute(): Promise<MessagingProvider[]> {
    return this.providers.list();
  }
}

/**
 * Salva o provedor do canal (cria ou atualiza). O segredo é obrigatório na
 * primeira vez; depois, ausente = manter o salvo.
 */
@Injectable()
export class SaveMessagingProviderUseCase {
  constructor(
    @Inject(MESSAGING_PROVIDER_REPOSITORY) private readonly providers: MessagingProviderRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async execute(input: {
    settings: ProviderSettings;
    secret?: string;
  }): Promise<MessagingProvider> {
    const secret = input.secret?.trim() ? this.seal(input.secret) : undefined;
    const channel: MessagingChannel = input.settings.provider === 'sendgrid' ? 'email' : 'sms';
    const existing = await this.providers.findByChannel(channel);

    let provider: MessagingProvider;
    if (existing) {
      existing.reconfigure(input.settings, secret);
      provider = existing;
    } else {
      if (!secret) throw new InvalidMessagingSettingsError('MESSAGING_SECRET_REQUIRED');
      provider = MessagingProvider.configure(this.ids.generate(), {
        tenantId: this.tenant.tenantId,
        settings: input.settings,
        secret,
      });
    }
    await this.providers.save(provider);
    return provider;
  }

  private seal(raw: string): SealedSecret {
    const value = raw.trim();
    assertValidSecret(value);
    return { sealed: this.cipher.seal(value), hint: value.slice(-4) };
  }
}

@Injectable()
export class RemoveMessagingProviderUseCase {
  constructor(
    @Inject(MESSAGING_PROVIDER_REPOSITORY) private readonly providers: MessagingProviderRepository,
  ) {}

  async execute(channel: MessagingChannel): Promise<void> {
    const provider = await this.providers.findByChannel(channel);
    if (!provider) throw new MessagingNotConfiguredError();
    await this.providers.delete(provider);
  }
}

const TEST_EMAIL = {
  subject: 'Teste de envio do Omnichannel',
  text: 'Se você recebeu esta mensagem, o envio de e-mails da sua conta no Omnichannel está funcionando.',
};
const TEST_SMS = 'Teste do Omnichannel: o envio de SMS da sua conta está funcionando.';

/**
 * Envia uma mensagem de teste e registra o resultado no provedor (verificado
 * ou falhando, com a mensagem do provedor).
 *
 * Exceção consciente à regra "externo vai para fila": quem configura precisa
 * da resposta na tela (chave válida? remetente verificado?). O cliente HTTP
 * tem tempo limite curto. Os envios de verdade vão pela fila.
 */
@Injectable()
export class SendTestMessageUseCase {
  constructor(
    @Inject(MESSAGING_PROVIDER_REPOSITORY) private readonly providers: MessagingProviderRepository,
    @Inject(PROVIDER_CLIENTS) private readonly clients: ProviderClients,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
  ) {}

  async execute(input: { channel: MessagingChannel; to: string }): Promise<MessagingProvider> {
    const provider = await this.providers.findByChannel(input.channel);
    if (!provider) throw new MessagingNotConfiguredError();
    const secret = this.cipher.open(provider.secret.sealed);

    try {
      if (provider.settings.provider === 'sendgrid') {
        const to = normalizeEmail(input.to);
        if (!to) throw new InvalidMessagingSettingsError('MESSAGING_INVALID_RECIPIENT');
        await this.clients
          .email(provider.settings.provider)
          .send(provider.settings, secret, { to, ...TEST_EMAIL });
      } else {
        const to = normalizePhoneNumber(input.to);
        if (!to) throw new InvalidMessagingSettingsError('MESSAGING_INVALID_RECIPIENT');
        await this.clients
          .sms(provider.settings.provider)
          .send(provider.settings, secret, { to, body: TEST_SMS });
      }
      provider.recordCheck({ ok: true });
    } catch (error) {
      // Destino inválido é erro de quem digitou, não da configuração.
      if (error instanceof InvalidMessagingSettingsError) throw error;
      provider.recordCheck({ ok: false, error: reasonOf(error) });
      await this.providers.save(provider);
      throw error;
    }
    await this.providers.save(provider);
    return provider;
  }
}

function reasonOf(error: unknown): string {
  if (error instanceof ProviderRejectedError || error instanceof ProviderUnavailableError) {
    return error.reason;
  }
  return error instanceof DomainError ? error.code : 'Erro inesperado ao falar com o provedor';
}

import { Inject, Injectable } from '@nestjs/common';
import { SignUpClosedError } from '../domain/errors/sign-up-closed.error';
import { signUpAvailability, type SignUpAvailability } from '../domain/sign-up-policy';
import type { Tenant } from '../domain/tenant.entity';
import { SIGN_UP_SETTINGS, type SignUpSettings } from './ports/sign-up-settings';
import { TENANT_REPOSITORY, type TenantRepository } from './ports/tenant.repository';

export interface SignUpGateDecision {
  availability: SignUpAvailability;
  /** A conta da plataforma, mãe do cadastro (null só no `bootstrap`). */
  root: Tenant | null;
}

/**
 * Quem pode se cadastrar agora — uma regra só para o cadastro e para a
 * consulta pública que o front usa para esconder a tela.
 */
@Injectable()
export class SignUpGate {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(SIGN_UP_SETTINGS) private readonly settings: SignUpSettings,
  ) {}

  async decide(): Promise<SignUpGateDecision> {
    const root = await this.tenants.findRoot();
    // Com raiz, não precisa saber se há outras contas: evita a segunda consulta.
    const hasAnyAccount = root !== null || (await this.tenants.existsAny());
    const availability = signUpAvailability({
      publicSignupEnabled: this.settings.publicSignupEnabled,
      hasRoot: root !== null,
      hasAnyAccount,
    });
    return { availability, root };
  }

  /** Lança `SignUpClosedError` (403) quando o cadastro não aceita; senão devolve a mãe. */
  async ensureOpen(): Promise<Tenant | null> {
    const { availability, root } = await this.decide();
    if (availability === 'disabled') throw new SignUpClosedError('SIGNUP_DISABLED');
    if (availability === 'platform-not-ready') {
      throw new SignUpClosedError('SIGNUP_PLATFORM_NOT_READY');
    }
    return root;
  }
}

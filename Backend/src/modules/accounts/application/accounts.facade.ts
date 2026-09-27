import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../shared/application/actor-context';
import type { Permission } from '../domain/permissions';
import { CurrentAccess } from './current-access';
import { ResolveAccessUseCase } from './use-cases/resolve-access/resolve-access.use-case';

/** O membro da requisição atual, como outros módulos o enxergam. */
export interface MemberAccess {
  membershipId: string;
  permissions: Permission[];
}

/**
 * API síncrona do módulo para outros módulos (ex.: conversations aplicando
 * o escopo `:own`/`:all` das permissões). Exportada pelo `index.ts`.
 */
@Injectable()
export class AccountsFacade {
  constructor(
    private readonly access: CurrentAccess,
    private readonly resolveAccess: ResolveAccessUseCase,
  ) {}

  /** Só em requisições autenticadas (usa o cache de acesso do AccessGuard). */
  async currentMember(): Promise<MemberAccess> {
    const { membershipId, permissions } = await this.access.get();
    return { membershipId, permissions };
  }

  /**
   * Acesso de um ator fora de uma requisição HTTP (ex.: conexão WebSocket).
   * Mesmas regras do AccessGuard: vínculo ativo, do mesmo usuário e tenant,
   * conta não suspensa — senão lança `AccountAccessDeniedError` (401).
   */
  async accessOf(actor: Actor): Promise<MemberAccess> {
    const { membershipId, permissions } = await this.resolveAccess.execute(actor);
    return { membershipId, permissions };
  }
}

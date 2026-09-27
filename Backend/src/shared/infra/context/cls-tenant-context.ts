import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TenantNotResolvedError, type TenantContext } from '../../application/tenant-context';
import type { AppClsStore } from './app-cls-store';

/**
 * O tenant da operação: o do ator autenticado (HTTP, vindo do token) ou,
 * em jobs do worker, o que veio junto com o job (ver TenantAwareProcessor).
 */
@Injectable()
export class ClsTenantContext implements TenantContext {
  constructor(private readonly cls: ClsService<AppClsStore>) {}

  get tenantId(): string {
    const tenantId = this.cls.get('actor')?.tenantId ?? this.cls.get('tenantId');
    if (!tenantId) throw new TenantNotResolvedError();
    return tenantId;
  }
}

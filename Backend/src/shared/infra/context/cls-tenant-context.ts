import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TenantNotResolvedError, type TenantContext } from '../../application/tenant-context';
import type { AppClsStore } from './app-cls-store';

/**
 * Lê o tenant do contexto da operação (CLS = continuation-local storage:
 * um "armazenamento por requisição" que acompanha todo o fluxo assíncrono).
 */
@Injectable()
export class ClsTenantContext implements TenantContext {
  constructor(private readonly cls: ClsService<AppClsStore>) {}

  get tenantId(): string {
    const tenantId = this.cls.get('tenantId');
    if (!tenantId) throw new TenantNotResolvedError();
    return tenantId;
  }
}

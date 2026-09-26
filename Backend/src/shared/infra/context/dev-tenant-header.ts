import type { IncomingMessage } from 'node:http';
import type { ClsService } from 'nestjs-cls';
import { z } from 'zod';
import type { AppClsStore } from './app-cls-store';

export const DEV_TENANT_HEADER = 'x-dev-tenant-id';

/**
 * TEMPORÁRIO — remover quando o AuthGuard (módulo identity) existir.
 *
 * Enquanto não há autenticação, permite escolher o tenant por header em
 * desenvolvimento. Viola de propósito a regra "tenant só vem do token"
 * (ADR 0002), por isso nunca é aplicado em produção.
 */
export function applyDevTenantHeader(
  cls: ClsService<AppClsStore>,
  req: IncomingMessage,
  isProduction: boolean,
): void {
  if (isProduction) return;

  const parsed = z.uuid().safeParse(req.headers[DEV_TENANT_HEADER]);
  if (parsed.success) cls.set('tenantId', parsed.data);
}

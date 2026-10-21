import { Injectable } from '@nestjs/common';
import type { AccountStanding } from '../../application/account-standing';
import { PrismaService } from './prisma.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PROVISÓRIO: lê `accounts.tenants.status` direto. O dono dessa regra é o
 * módulo accounts (`Tenant.allowsAccess`, a mesma conferência da chave de
 * API); o lugar certo é uma classe lá dentro sobre o `TenantRepository`,
 * exportada pelo `AccountsModule` como o `PLAN_ENTITLEMENTS_PROVIDER`. Ficou
 * aqui porque o accounts estava sendo alterado por outro contexto na mesma
 * rodada (20/10/2026). Ao mover, apagar este arquivo e o provider do
 * `SharedInfraModule` — os consumidores só conhecem o token.
 *
 * Uma consulta pela chave primária por requisição pública; sem cache de
 * propósito: suspender tem que valer na hora.
 */
@Injectable()
export class PrismaAccountStanding implements AccountStanding {
  constructor(private readonly prisma: PrismaService) {}

  async acceptsPublicTraffic(tenantId: string): Promise<boolean> {
    if (!UUID.test(tenantId)) return false;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { status: true },
    });
    // Mesmo critério de `Tenant.allowsAccess`: só `suspended` barra.
    return tenant !== null && tenant.status !== 'suspended';
  }
}

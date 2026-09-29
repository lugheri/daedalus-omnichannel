import {
  applyDecorators,
  Inject,
  Injectable,
  UseGuards,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Public } from '../../../shared/http/public.decorator';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { AuthenticateApiKeyUseCase } from '../application/use-cases/api-keys/api-keys.use-cases';

/**
 * Autentica por chave de API (`Authorization: Bearer omni_...` ou
 * `X-Api-Key: omni_...`) e fixa o tenant da operação — dali em diante os
 * repositórios filtram pelo tenant da chave, como numa requisição logada.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authenticate: AuthenticateApiKeyUseCase,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const { tenantId } = await this.authenticate.execute(keyFrom(request));
    this.tenant.enter(tenantId);
    return true;
  }
}

function keyFrom(request: FastifyRequest): string | undefined {
  const header = request.headers['x-api-key'];
  if (typeof header === 'string') return header;
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

/**
 * Rota de integração: sem login de usuário (pula JWT e AccessGuard), exige
 * chave de API da conta. Ex.: `@ApiKeyAuth()` no endpoint do formulário do site.
 */
export const ApiKeyAuth = () => applyDecorators(Public(), UseGuards(ApiKeyGuard));

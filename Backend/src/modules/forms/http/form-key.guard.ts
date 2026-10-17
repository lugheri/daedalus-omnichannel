import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { TENANT_CONTEXT, type TenantContext } from '../../../shared/application/tenant-context';
import { AuthenticateFormKeyUseCase } from '../application/use-cases/forms.use-cases';

/** O formulário que a chave da URL autenticou (o guard põe na requisição). */
export type FormKeyRequest = FastifyRequest & { formId?: string };

/**
 * Autentica o envio público pela chave do formulário (`:key` na URL) e fixa
 * o tenant dele — como o guard da chave de API. Chave inexistente: 404.
 */
@Injectable()
export class FormKeyGuard implements CanActivate {
  constructor(
    private readonly authenticate: AuthenticateFormKeyUseCase,
    @Inject(TENANT_CONTEXT) private readonly tenant: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FormKeyRequest>();
    const key = (request.params as Record<string, string | undefined>).key ?? '';
    const { formId, tenantId } = await this.authenticate.execute(key);
    this.tenant.enter(tenantId);
    request.formId = formId;
    return true;
  }
}

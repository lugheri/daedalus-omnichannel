import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { TenantNotResolvedError } from '../application/tenant-context';
import {
  ConflictError,
  DomainError,
  NotFoundError,
  UnauthorizedError,
} from '../domain/domain-error';

/**
 * Converte erros de domínio em respostas HTTP. Assim domain e application
 * lançam erros de negócio sem saber que HTTP existe.
 *
 * Corpo da resposta: { code, message } — o frontend decide pelo `code`.
 */
@Catch(DomainError, TenantNotResolvedError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError | TenantNotResolvedError, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    void reply.status(statusFor(error)).send({ code: error.code, message: error.message });
  }
}

function statusFor(error: DomainError | TenantNotResolvedError): number {
  if (error instanceof TenantNotResolvedError) return HttpStatus.UNAUTHORIZED;
  if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
  if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof ConflictError) return HttpStatus.CONFLICT;
  return HttpStatus.UNPROCESSABLE_ENTITY;
}

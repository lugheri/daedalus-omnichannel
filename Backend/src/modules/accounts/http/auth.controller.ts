import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { Public } from '../../../shared/http/public.decorator';
import { TrustedOriginGuard } from '../../../shared/http/trusted-origin.guard';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { AuthTokensPresenter, RefreshTokenCookie } from '../../identity';
import { LogInUseCase } from '../application/use-cases/log-in/log-in.use-case';
import { SignUpUseCase } from '../application/use-cases/sign-up/sign-up.use-case';
import { logInSchema, type LogInDto } from './dto/log-in.dto';
import { signUpSchema, type SignUpDto } from './dto/sign-up.dto';
import { TenantPresenter } from './tenant.presenter';

const MINUTE = 60_000;

@Public()
@UseGuards(TrustedOriginGuard)
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly signUpUseCase: SignUpUseCase,
    private readonly logInUseCase: LogInUseCase,
    private readonly refreshTokenCookie: RefreshTokenCookie,
  ) {}

  /** Cria uma conta nova (tenant) com a pessoa como Owner, já autenticada. */
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60 * MINUTE } })
  async signUp(
    @Body(new ZodValidationPipe(signUpSchema)) body: SignUpDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.signUpUseCase.execute(body);
    this.refreshTokenCookie.write(reply, result.tokens);
    return {
      tenant: TenantPresenter.toHttp(result.tenant),
      ...AuthTokensPresenter.toHttp(result.tokens),
    };
  }

  /**
   * 200 com tokens, ou 200 com `tenantSelectionRequired` e a lista de contas
   * quando a pessoa tem mais de uma e não informou `tenantId`.
   *
   * Limite por IP contra força bruta: 10 tentativas por minuto; estourando,
   * o IP fica bloqueado por 15 minutos.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: MINUTE, blockDuration: 15 * MINUTE } })
  async logIn(
    @Body(new ZodValidationPipe(logInSchema)) body: LogInDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.logInUseCase.execute(body);

    if (result.kind === 'tenant-selection-required') {
      return {
        tenantSelectionRequired: true,
        tenants: result.tenants.map((tenant) => TenantPresenter.toHttp(tenant)),
      };
    }

    this.refreshTokenCookie.write(reply, result.tokens);
    return {
      tenant: TenantPresenter.toHttp(result.tenant),
      ...AuthTokensPresenter.toHttp(result.tokens),
    };
  }
}

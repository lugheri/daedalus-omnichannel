import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { ACTOR_CONTEXT, type ActorContext } from '../../../shared/application/actor-context';
import { TrustedOriginGuard } from '../../../shared/http/trusted-origin.guard';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { AuthTokensPresenter, RefreshTokenCookie } from '../../identity';
import { SwitchAccountUseCase } from '../application/use-cases/my-accounts/my-accounts.use-cases';
import { switchAccountSchema, type SwitchAccountDto } from './dto/switch-account.dto';
import { TenantPresenter } from './tenant.presenter';

/**
 * Troca de conta de quem já está logado. Fica em `/v1/auth` (e não em
 * `/v1/me`) porque grava o cookie do refresh token, restrito a esse caminho.
 * Diferente do resto de `/v1/auth`, exige access token: não é `@Public`.
 */
@UseGuards(TrustedOriginGuard)
@Controller('v1/auth')
export class AccountSwitchController {
  constructor(
    private readonly switchAccount: SwitchAccountUseCase,
    private readonly refreshTokenCookie: RefreshTokenCookie,
    @Inject(ACTOR_CONTEXT) private readonly actors: ActorContext,
  ) {}

  @Post('switch-account')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async switch(
    @Body(new ZodValidationPipe(switchAccountSchema)) body: SwitchAccountDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.switchAccount.execute(this.actors.actor, body.tenantId);
    this.refreshTokenCookie.write(reply, result.tokens);
    return {
      tenant: TenantPresenter.toHttp(result.tenant),
      ...AuthTokensPresenter.toHttp(result.tokens),
    };
  }
}

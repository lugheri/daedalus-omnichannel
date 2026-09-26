import { Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../../../shared/http/public.decorator';
import { TrustedOriginGuard } from '../../../shared/http/trusted-origin.guard';
import { EndSessionUseCase } from '../application/use-cases/end-session/end-session.use-case';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session/refresh-session.use-case';
import { AuthTokensPresenter } from './auth-tokens.presenter';
import { RefreshTokenCookie } from './refresh-token-cookie';

/**
 * Rotas de sessão que só dependem do refresh token (lido do cookie).
 * Cadastro e login ficam no módulo accounts, porque envolvem tenants.
 */
@Public()
@UseGuards(TrustedOriginGuard)
@Controller('v1/auth')
export class AuthSessionController {
  constructor(
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly endSession: EndSessionUseCase,
    private readonly cookie: RefreshTokenCookie,
  ) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    try {
      const tokens = await this.refreshSession.execute(this.cookie.read(request) ?? '');
      this.cookie.write(reply, tokens);
      return AuthTokensPresenter.toHttp(tokens);
    } catch (error) {
      // Cookie inválido/revogado não serve para nada: remove do navegador.
      this.cookie.clear(reply);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.endSession.execute(this.cookie.read(request) ?? '');
    this.cookie.clear(reply);
  }
}

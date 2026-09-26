import '@fastify/cookie';
import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthTokens } from '../application/auth-tokens';
import { IDENTITY_SETTINGS, type IdentitySettings } from '../application/ports/identity-settings';

const COOKIE_NAME = 'refresh_token';
/** O cookie só viaja nas rotas de sessão — nunca nas demais chamadas da API. */
const COOKIE_PATH = '/v1/auth';

/**
 * O refresh token vive num cookie que o JavaScript do frontend não consegue
 * ler (HttpOnly): um XSS no front não rouba a sessão. O access token, curto,
 * vai no corpo da resposta e fica só em memória no front.
 *
 * SameSite=Strict: o navegador não envia o cookie em requisições iniciadas
 * por outros sites. Front e API precisam estar no mesmo "site"
 * (ex.: app.dominio.com e api.dominio.com; em dev, localhost).
 */
@Injectable()
export class RefreshTokenCookie {
  constructor(@Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings) {}

  write(reply: FastifyReply, tokens: AuthTokens): void {
    reply.setCookie(COOKIE_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure: this.settings.secureCookies,
      sameSite: 'strict',
      path: COOKIE_PATH,
      expires: tokens.refreshTokenExpiresAt,
    });
  }

  clear(reply: FastifyReply): void {
    reply.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: this.settings.secureCookies,
      sameSite: 'strict',
      path: COOKIE_PATH,
    });
  }

  read(request: FastifyRequest): string | undefined {
    return request.cookies[COOKIE_NAME];
  }
}

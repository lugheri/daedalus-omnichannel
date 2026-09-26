import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { EndSessionUseCase } from '../application/use-cases/end-session/end-session.use-case';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session/refresh-session.use-case';
import { AuthTokensPresenter } from './auth-tokens.presenter';
import { refreshTokenSchema, type RefreshTokenDto } from './dto/refresh-token.dto';

/**
 * Rotas de sessão que só dependem do refresh token. Cadastro e login ficam
 * no módulo accounts, porque envolvem tenants e vínculos.
 */
@Controller('v1/auth')
export class AuthSessionController {
  constructor(
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly endSession: EndSessionUseCase,
  ) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenDto) {
    return AuthTokensPresenter.toHttp(await this.refreshSession.execute(body.refreshToken));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenDto) {
    await this.endSession.execute(body.refreshToken);
  }
}

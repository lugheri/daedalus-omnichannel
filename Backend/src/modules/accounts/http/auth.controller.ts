import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe';
import { AuthTokensPresenter } from '../../identity';
import { LogInUseCase } from '../application/use-cases/log-in/log-in.use-case';
import { SignUpUseCase } from '../application/use-cases/sign-up/sign-up.use-case';
import { logInSchema, type LogInDto } from './dto/log-in.dto';
import { signUpSchema, type SignUpDto } from './dto/sign-up.dto';
import { TenantPresenter } from './tenant.presenter';

// TODO(auth): marcar como @Public() quando o AuthGuard global existir.
// TODO(auth): rate limit por IP/e-mail no login e no cadastro.
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly signUpUseCase: SignUpUseCase,
    private readonly logInUseCase: LogInUseCase,
  ) {}

  /** Cria uma conta nova (tenant) com a pessoa como Owner, já autenticada. */
  @Post('signup')
  async signUp(@Body(new ZodValidationPipe(signUpSchema)) body: SignUpDto) {
    const result = await this.signUpUseCase.execute(body);
    return {
      tenant: TenantPresenter.toHttp(result.tenant),
      ...AuthTokensPresenter.toHttp(result.tokens),
    };
  }

  /**
   * 200 com tokens, ou 200 com `tenantSelectionRequired` e a lista de contas
   * quando a pessoa tem mais de uma e não informou `tenantId`.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async logIn(@Body(new ZodValidationPipe(logInSchema)) body: LogInDto) {
    const result = await this.logInUseCase.execute(body);

    if (result.kind === 'tenant-selection-required') {
      return {
        tenantSelectionRequired: true,
        tenants: result.tenants.map((tenant) => TenantPresenter.toHttp(tenant)),
      };
    }
    return {
      tenant: TenantPresenter.toHttp(result.tenant),
      ...AuthTokensPresenter.toHttp(result.tokens),
    };
  }
}

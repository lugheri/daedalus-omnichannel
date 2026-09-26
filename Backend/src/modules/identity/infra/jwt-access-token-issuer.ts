import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AccessTokenClaims,
  AccessTokenIssuer,
  IssuedAccessToken,
} from '../application/ports/access-token-issuer';
import { IDENTITY_SETTINGS, type IdentitySettings } from '../application/ports/identity-settings';

/** JWT assinado com HS256; segredo e validade vêm da configuração do módulo. */
@Injectable()
export class JwtAccessTokenIssuer implements AccessTokenIssuer {
  constructor(
    private readonly jwt: JwtService,
    @Inject(IDENTITY_SETTINGS) private readonly settings: IdentitySettings,
  ) {}

  async issue(claims: AccessTokenClaims): Promise<IssuedAccessToken> {
    const token = await this.jwt.signAsync({ ...claims });
    return { token, expiresInSeconds: this.settings.accessTokenTtlSeconds };
  }
}

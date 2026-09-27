import type { ExecutionContext } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantNotResolvedError } from '../../../shared/application/tenant-context';
import { Public } from '../../../shared/http/public.decorator';
import { InMemoryActorContext } from '../../../shared/testing/fakes';
import type { AccessTokenClaims } from '../application/ports/access-token-issuer';
import type { AccessTokenVerifier } from '../application/ports/access-token-verifier';
import { AuthenticateAccessTokenUseCase } from '../application/use-cases/authenticate-access-token/authenticate-access-token.use-case';
import { InvalidAccessTokenError } from '../domain/errors/invalid-access-token.error';
import { InMemoryRevokedSessionList } from '../testing/fakes';
import { JwtAuthGuard } from './jwt-auth.guard';

const CLAIMS: AccessTokenClaims = {
  sub: 'user-1',
  tid: 'tenant-1',
  mid: 'membership-1',
  sid: 'session-1',
};

/** Aceita só o token 'valid-token'. */
class FakeVerifier implements AccessTokenVerifier {
  verify(token: string) {
    return Promise.resolve(token === 'valid-token' ? CLAIMS : null);
  }
}

@Controller()
class ProbeController {
  @Get() protectedRoute() {}
  @Public() @Get() publicRoute() {}
}

function contextFor(handler: 'protectedRoute' | 'publicRoute', authorization?: string) {
  return {
    // O Reflector só lê os metadados do método; ele nunca é chamado.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    getHandler: () => ProbeController.prototype[handler],
    getClass: () => ProbeController,
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let actors: InMemoryActorContext;
  let revoked: InMemoryRevokedSessionList;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    actors = new InMemoryActorContext();
    revoked = new InMemoryRevokedSessionList();
    guard = new JwtAuthGuard(
      new Reflector(),
      new AuthenticateAccessTokenUseCase(new FakeVerifier(), revoked),
      actors,
    );
  });

  it('puts the authenticated actor (and so the tenant) in the request context', async () => {
    await expect(
      guard.canActivate(contextFor('protectedRoute', 'Bearer valid-token')),
    ).resolves.toBe(true);
    expect(actors.actor).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
      membershipId: 'membership-1',
      sessionId: 'session-1',
    });
  });

  it.each([
    ['no Authorization header', undefined],
    ['an invalid token', 'Bearer forged-token'],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['an empty bearer', 'Bearer '],
  ])('rejects a protected route with %s', async (_, header) => {
    await expect(guard.canActivate(contextFor('protectedRoute', header))).rejects.toThrow(
      InvalidAccessTokenError,
    );
  });

  it('lets @Public() routes through without a token (and without an actor)', async () => {
    await expect(guard.canActivate(contextFor('publicRoute'))).resolves.toBe(true);
    expect(() => actors.actor).toThrow(TenantNotResolvedError);
  });
});

describe('JwtAuthGuard with a revoked session', () => {
  it('rejects a valid token whose session was revoked (logout)', async () => {
    const revoked = new InMemoryRevokedSessionList();
    await revoked.add('session-1');
    const guard = new JwtAuthGuard(
      new Reflector(),
      new AuthenticateAccessTokenUseCase(new FakeVerifier(), revoked),
      new InMemoryActorContext(),
    );

    await expect(
      guard.canActivate(contextFor('protectedRoute', 'Bearer valid-token')),
    ).rejects.toThrow(InvalidAccessTokenError);
  });
});

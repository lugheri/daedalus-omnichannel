import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { TrustedOriginGuard } from './trusted-origin.guard';

function contextWithOrigin(origin?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { origin } }) }),
  } as unknown as ExecutionContext;
}

describe('TrustedOriginGuard', () => {
  const guard = new TrustedOriginGuard({
    corsOrigins: ['https://app.example.com'],
  } as unknown as AppConfig);

  it('lets the frontend origin through', () => {
    expect(guard.canActivate(contextWithOrigin('https://app.example.com'))).toBe(true);
  });

  it('blocks requests coming from another site', () => {
    expect(() => guard.canActivate(contextWithOrigin('https://evil.example'))).toThrow(
      ForbiddenException,
    );
  });

  it('lets non-browser clients (no Origin header) through', () => {
    expect(guard.canActivate(contextWithOrigin(undefined))).toBe(true);
  });
});

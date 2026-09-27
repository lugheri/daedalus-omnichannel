import type { ConnectionAuthenticator } from '../ports/connection-authenticator';
import { OpenConnectionUseCase } from './open-connection.use-case';

const expiresAt = new Date('2030-01-01T10:15:00Z');

/** Aceita só 'valid-token', como um Agent do tenant-a. */
const authenticator: ConnectionAuthenticator = {
  authenticate: (token) =>
    token === 'valid-token'
      ? Promise.resolve({
          tenantId: 'tenant-a',
          membershipId: 'agent-1',
          permissions: ['contacts:view', 'conversations:view:own'],
          expiresAt,
        })
      : Promise.reject(new Error('AUTH_INVALID_ACCESS_TOKEN')),
};

describe('OpenConnectionUseCase', () => {
  const open = (token?: string) => new OpenConnectionUseCase(authenticator).execute(token);

  it('joins the member room and one room per permission of the tenant', async () => {
    expect(await open('valid-token')).toEqual({
      tenantId: 'tenant-a',
      membershipId: 'agent-1',
      rooms: [
        'member:agent-1',
        'tenant:tenant-a:perm:contacts:view',
        'tenant:tenant-a:perm:conversations:view:own',
      ],
      expiresAt,
    });
  });

  it('refuses an invalid or missing token', async () => {
    await expect(open('forged')).rejects.toThrow('AUTH_INVALID_ACCESS_TOKEN');
    await expect(open()).rejects.toThrow('AUTH_INVALID_ACCESS_TOKEN');
  });
});

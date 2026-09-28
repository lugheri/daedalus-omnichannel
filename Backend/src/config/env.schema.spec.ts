import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withSecretFiles } from './env.schema';

describe('withSecretFiles (Docker secrets)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'omni-secrets-'));
  const secret = (name: string, value: string) => {
    const path = join(dir, name);
    writeFileSync(path, value);
    return path;
  };

  it('reads VAR from the file in VAR_FILE (trimming the trailing newline)', () => {
    const env = withSecretFiles({ JWT_SECRET_FILE: secret('jwt', 's3cr3t-value\n') });
    expect(env.JWT_SECRET).toBe('s3cr3t-value');
  });

  it('the direct value wins over the file', () => {
    const env = withSecretFiles({ JWT_SECRET: 'direct', JWT_SECRET_FILE: secret('jwt2', 'file') });
    expect(env.JWT_SECRET).toBe('direct');
  });

  it('fails loudly when the file is missing (never boots with a missing secret)', () => {
    expect(() => withSecretFiles({ JWT_SECRET_FILE: join(dir, 'nope') })).toThrow(
      /JWT_SECRET_FILE/,
    );
  });
});

import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppConfigModule } from '../../src/config/app-config.module';
import { FILE_STORAGE, type FileStorage } from '../../src/shared/application/file-storage';
import { S3FileStorage } from '../../src/shared/infra/storage/s3-file-storage';

/** O adapter S3 contra o MinIO do Docker (chaves de teste em `e2e/`, apagadas no fim). */
describe('FileStorage S3 (MinIO real)', () => {
  let app: TestingModule;
  let storage: FileStorage;
  const key = `e2e/${randomUUID()}.txt`;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppConfigModule],
      providers: [{ provide: FILE_STORAGE, useClass: S3FileStorage }],
    }).compile();
    storage = app.get(FILE_STORAGE);
  });

  afterAll(async () => {
    await storage.delete(key);
    await app.close();
  });

  it('writes, reads back and streams a file', async () => {
    await storage.put(key, Buffer.from('olá, arquivo'), 'text/plain');

    expect((await storage.read(key))?.toString()).toBe('olá, arquivo');

    const opened = await storage.open(key);
    const chunks: Buffer[] = [];
    for await (const chunk of opened!.stream) chunks.push(Buffer.from(chunk as Uint8Array));
    expect(Buffer.concat(chunks).toString()).toBe('olá, arquivo');
    expect(opened!.size).toBe(Buffer.byteLength('olá, arquivo'));
  });

  it('a missing key is null, not an error', async () => {
    expect(await storage.read(`e2e/${randomUUID()}`)).toBeNull();
    expect(await storage.open(`e2e/${randomUUID()}`)).toBeNull();
  });

  it('deletes', async () => {
    const other = `e2e/${randomUUID()}`;
    await storage.put(other, Buffer.from('x'), 'text/plain');
    await storage.delete(other);
    expect(await storage.read(other)).toBeNull();
  });
});

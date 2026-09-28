import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Readable } from 'node:stream';
import { AppConfig } from '../../../config/app-config';
import type { FileStorage } from '../../application/file-storage';

/**
 * FileStorage sobre a API S3 (S3 em produção, MinIO em dev). Credenciais e
 * endpoint vêm do env; o bucket é privado — nada aqui gera link público.
 */
@Injectable()
export class S3FileStorage implements FileStorage, OnApplicationShutdown {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: AppConfig) {
    const storage = config.storage;
    this.bucket = storage.bucket;
    this.client = new S3Client({
      region: storage.region,
      endpoint: storage.endpoint,
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async read(key: string): Promise<Buffer | null> {
    const object = await this.get(key);
    if (!object?.Body) return null;
    return Buffer.from(await object.Body.transformToByteArray());
  }

  async open(key: string): Promise<{ stream: Readable; size: number | null } | null> {
    const object = await this.get(key);
    if (!object?.Body) return null;
    return { stream: object.Body as Readable, size: object.ContentLength ?? null };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  onApplicationShutdown(): void {
    this.client.destroy();
  }

  private async get(key: string) {
    try {
      return await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  }
}

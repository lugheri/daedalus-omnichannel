import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import type { SiteHosting } from '../application/ports/site-hosting';
import { InvalidSiteError } from '../domain/errors/invalid-site.error';
import { SITES_SETTINGS, type SitesSettings } from './sites-settings';

/** Pasta das imagens no bucket = o "site" `media` (slug reservado). */
const MEDIA_PREFIX = 'media';

/**
 * Bucket público de sites (ADR 0008) sobre a API S3: `<slug>/index.html` e
 * `media/<tenant>/<id>.<ext>`, servidos pelo nginx dos sites. Mesmo
 * endpoint e região do bucket privado; bucket e (opcionalmente) chaves
 * próprios. O `Cache-Control` segue o do `publish.sh`: HTML 60 s, imagens 1 dia.
 */
@Injectable()
export class S3SiteHosting implements SiteHosting, OnApplicationShutdown {
  private readonly hosting: NonNullable<SitesSettings['hosting']> | null;
  private readonly client: S3Client | null;
  readonly enabled: boolean;

  constructor(@Inject(SITES_SETTINGS) settings: SitesSettings) {
    this.hosting = settings.hosting;
    this.enabled = this.hosting !== null;
    this.client = this.hosting
      ? new S3Client({
          region: this.hosting.region,
          endpoint: this.hosting.endpoint,
          forcePathStyle: this.hosting.forcePathStyle,
          credentials: {
            accessKeyId: this.hosting.accessKeyId,
            secretAccessKey: this.hosting.secretAccessKey,
          },
        })
      : null;
  }

  siteUrl(slug: string): string {
    return (this.hosting?.urlPattern ?? '').replace('{slug}', slug);
  }

  mediaUrl(key: string): string {
    return `${this.siteUrl(MEDIA_PREFIX)}/${key}`;
  }

  async publishPage(slug: string, html: string): Promise<void> {
    await this.put(`${slug}/index.html`, Buffer.from(html, 'utf8'), {
      contentType: 'text/html; charset=utf-8',
      cacheControl: 'public, max-age=60',
    });
  }

  async removePage(slug: string): Promise<void> {
    await this.remove(`${slug}/index.html`);
  }

  async putMedia(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.put(`${MEDIA_PREFIX}/${key}`, body, {
      contentType,
      cacheControl: 'public, max-age=86400',
    });
  }

  async removeMedia(key: string): Promise<void> {
    await this.remove(`${MEDIA_PREFIX}/${key}`);
  }

  onApplicationShutdown(): void {
    this.client?.destroy();
  }

  private get s3(): { client: S3Client; bucket: string; publicAcl: boolean } {
    if (!this.client || !this.hosting) throw new InvalidSiteError('SITES_NOT_CONFIGURED');
    return { client: this.client, bucket: this.hosting.bucket, publicAcl: this.hosting.publicAcl };
  }

  private async put(
    key: string,
    body: Buffer,
    meta: { contentType: string; cacheControl: string },
  ): Promise<void> {
    const { client, bucket, publicAcl } = this.s3;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: meta.contentType,
        CacheControl: meta.cacheControl,
        ACL: publicAcl ? 'public-read' : undefined,
      }),
    );
  }

  private async remove(key: string): Promise<void> {
    const { client, bucket } = this.s3;
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}

import type { Env } from './env.schema';

export class AppConfig {
  constructor(private readonly env: Env) {}

  get nodeEnv() {
    return this.env.NODE_ENV;
  }

  get isProduction() {
    return this.env.NODE_ENV === 'production';
  }

  get host() {
    return this.env.HOST;
  }

  get port() {
    return this.env.PORT;
  }

  get databaseUrl() {
    return this.env.DATABASE_URL;
  }

  get publicApiUrl() {
    return this.env.PUBLIC_API_URL;
  }

  get sendgridApiUrl() {
    return this.env.SENDGRID_API_URL;
  }

  get twilioApiUrl() {
    return this.env.TWILIO_API_URL;
  }

  get appUrl() {
    return this.env.APP_URL;
  }

  get redisUrl() {
    return this.env.REDIS_URL;
  }

  get corsOrigins(): readonly string[] {
    return this.env.CORS_ORIGINS;
  }

  get trustProxy() {
    return this.env.TRUST_PROXY;
  }

  get queuePrefix() {
    return this.env.QUEUE_PREFIX;
  }

  get logLevel() {
    return this.env.LOG_LEVEL;
  }

  get connectorHealthPort() {
    return this.env.CONNECTOR_HEALTH_PORT;
  }

  get encryptionKey() {
    return this.env.ENCRYPTION_KEY;
  }

  get workerHealthPort() {
    return this.env.WORKER_HEALTH_PORT;
  }

  get jwtSecret() {
    return this.env.JWT_SECRET;
  }

  get accessTokenTtlSeconds() {
    return this.env.ACCESS_TOKEN_TTL_SECONDS;
  }

  get refreshTokenTtlDays() {
    return this.env.REFRESH_TOKEN_TTL_DAYS;
  }

  get storage() {
    return {
      endpoint: this.env.S3_ENDPOINT,
      region: this.env.S3_REGION,
      bucket: this.env.S3_BUCKET,
      accessKeyId: this.env.S3_ACCESS_KEY,
      secretAccessKey: this.env.S3_SECRET_KEY,
      forcePathStyle: this.env.S3_FORCE_PATH_STYLE,
    };
  }

  get mediaMaxBytes() {
    return this.env.MEDIA_MAX_MB * 1024 * 1024;
  }

  /** Bucket público e endereço dos sites; null = publicação desligada. */
  get sites() {
    const { SITES_BUCKET: bucket, SITES_URL: urlPattern } = this.env;
    if (!bucket || !urlPattern) return null;
    return {
      bucket,
      urlPattern,
      publicAcl: this.env.SITES_PUBLIC_ACL,
      accessKeyId: this.env.SITES_S3_ACCESS_KEY ?? this.env.S3_ACCESS_KEY,
      secretAccessKey: this.env.SITES_S3_SECRET_KEY ?? this.env.S3_SECRET_KEY,
    };
  }

  /** Domínio próprio dos sites (ADR 0011): destino do CNAME e, em dev, o atalho da verificação. */
  get siteDomains() {
    return {
      target: this.env.SITES_DOMAIN_TARGET?.trim() || null,
      checkVia: this.env.SITES_DOMAIN_CHECK_VIA ?? null,
    };
  }
}

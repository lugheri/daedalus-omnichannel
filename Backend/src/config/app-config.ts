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

  get jwtSecret() {
    return this.env.JWT_SECRET;
  }

  get accessTokenTtlSeconds() {
    return this.env.ACCESS_TOKEN_TTL_SECONDS;
  }

  get refreshTokenTtlDays() {
    return this.env.REFRESH_TOKEN_TTL_DAYS;
  }
}

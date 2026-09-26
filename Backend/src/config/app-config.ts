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
}

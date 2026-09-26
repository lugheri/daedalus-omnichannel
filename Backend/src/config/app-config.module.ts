import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config';
import { validateEnv } from './env.schema';

@Global()
@Module({
  providers: [
    {
      provide: AppConfig,
      useFactory: () => new AppConfig(validateEnv(process.env)),
    },
  ],
  exports: [AppConfig],
})
export class AppConfigModule {}

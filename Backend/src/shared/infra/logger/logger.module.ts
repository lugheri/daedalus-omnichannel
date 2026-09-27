import { Module } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from '../../../config/app-config';
import type { AppClsStore } from '../context/app-cls-store';
import { requestIdFor } from '../context/request-id';

/**
 * Logs estruturados (Pino). Em produção, JSON — uma linha por evento, pronta
 * para agregadores; em desenvolvimento, formato legível.
 *
 * Toda linha leva `correlationId` e, quando houver, `tenantId`: dá para seguir
 * uma operação da requisição HTTP até os jobs que ela gerou no worker.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.logLevel,
          transport: config.isProduction
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, ignore: 'pid,hostname' } },
          // Mesmo id do contexto (CLS): o correlation id da requisição, devolvido
          // no header X-Request-Id da resposta.
          genReqId: (req, res) => requestIdFor(req, res),
          mixin: () => {
            const cls = ClsServiceManager.getClsService<AppClsStore>();
            if (!cls.isActive()) return {};
            const tenantId = cls.get('actor')?.tenantId ?? cls.get('tenantId');
            return { correlationId: cls.getId(), ...(tenantId && { tenantId }) };
          },
          // Nunca logar credenciais, tokens ou cookies.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              '*.password',
              '*.token',
              '*.refreshToken',
              '*.accessToken',
            ],
            censor: '[redacted]',
          },
          autoLogging: {
            // Sondas de health a cada poucos segundos só poluiriam o log.
            ignore: (req) => req.url?.startsWith('/health') ?? false,
          },
        },
      }),
    }),
  ],
})
export class AppLoggerModule {}

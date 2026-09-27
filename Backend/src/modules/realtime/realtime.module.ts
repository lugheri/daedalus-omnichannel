import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts';
import { IdentityModule } from '../identity';
import { CONNECTION_AUTHENTICATOR } from './application/ports/connection-authenticator';
import { OpenConnectionUseCase } from './application/use-cases/open-connection.use-case';
import { RealtimeGateway } from './http/realtime.gateway';
import { FacadesConnectionAuthenticator } from './infra/facades-connection-authenticator';

/**
 * Tempo real: o gateway Socket.IO do processo `api`. Só entrega avisos; quem
 * emite são os módulos (pelo port RealtimeNotifier do shared kernel), de
 * qualquer processo.
 */
@Module({
  imports: [IdentityModule, AccountsModule],
  providers: [
    RealtimeGateway,
    OpenConnectionUseCase,
    { provide: CONNECTION_AUTHENTICATOR, useClass: FacadesConnectionAuthenticator },
  ],
})
export class RealtimeModule {}

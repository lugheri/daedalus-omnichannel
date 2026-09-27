import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import pino from 'pino';
import {
  WHATSAPP_QR_TTL_SECONDS,
  whatsAppQrCodeKey,
} from '../../contracts/whatsapp-connector.contract';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../shared/infra/prisma/prisma.service';
import { REDIS_CLIENT } from '../../shared/infra/redis/redis.module';
import { AuthStateStore } from './auth-state.store';
import { ConnectorReporter } from './connector-reporter';
import { SessionLeases } from './session-leases';
import { WhatsAppSession } from './whatsapp-session';

/** De quanto em quanto tempo conferir quais sessões devem estar de pé. */
const RECONCILE_INTERVAL_MS = 5_000;

/** Outra instância é dona da sessão: o job volta para a fila e tenta de novo. */
export class SessionOwnedElsewhereError extends Error {
  constructor(channelId: string) {
    super(`Session of channel ${channelId} is owned by another connector instance`);
  }
}

/**
 * Mantém de pé, nesta instância, as sessões do WhatsApp que devem estar
 * conectadas (ADR 0006).
 *
 * A fonte da verdade é a tabela `whatsapp_connector.sessions` (estado
 * desejado). A cada 5 s, a instância:
 *   1. renova o lease das sessões que já tem (e larga as que perdeu);
 *   2. encerra as que deixaram de ser desejadas;
 *   3. tenta assumir as desejadas que estão sem dono.
 * Assim, várias instâncias dividem as sessões entre si, e se uma morrer as
 * outras assumem as dela quando o lease expira (30 s).
 *
 * Comandos (conectar/desconectar) e o ciclo rodam em fila única — nunca ao
 * mesmo tempo —, para um não desfazer o que o outro está fazendo.
 */
@Injectable()
export class SessionManager implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SessionManager.name);
  private readonly baileysLogger: pino.Logger;
  private readonly sessions = new Map<string, WhatsAppSession>();
  private timer?: NodeJS.Timeout;
  private tail: Promise<unknown> = Promise.resolve();
  private reconcilePending = false;
  private shuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly leases: SessionLeases,
    private readonly authState: AuthStateStore,
    private readonly reporter: ConnectorReporter,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: AppConfig,
  ) {
    // O Baileys loga muito (e com dados de protocolo): só avisos e erros.
    this.baileysLogger = pino({ level: config.logLevel === 'debug' ? 'info' : 'warn' });
  }

  onApplicationBootstrap(): void {
    this.logger.log(`Instância ${this.leases.instanceId} pronta`);
    this.timer = setInterval(() => void this.reconcile(), RECONCILE_INTERVAL_MS);
    void this.reconcile();
  }

  async onApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;
    clearInterval(this.timer);
    // Sem logout: o pareamento continua válido e outra instância reassume.
    await this.serialized(async () => {
      await Promise.all(
        [...this.sessions.keys()].map((channelId) => this.stopLocal(channelId, { logout: false })),
      );
    });
  }

  /** Comando "conectar": passa a manter a sessão de pé (em alguma instância). */
  async start(channelId: string, tenantId: string): Promise<void> {
    await this.serialized(() => this.setDesired(channelId, tenantId, 'active'));
    void this.reconcile();
  }

  /**
   * Comando "desconectar". Com `logout`, desfaz o pareamento: quem executa é
   * a instância dona da sessão (as outras devolvem o job para a fila).
   */
  async stop(channelId: string, logout: boolean): Promise<void> {
    await this.serialized(async () => {
      if (!this.sessions.has(channelId) && (await this.leases.heldElsewhere(channelId))) {
        throw new SessionOwnedElsewhereError(channelId);
      }
      await this.setDesired(channelId, null, 'inactive');

      if (this.sessions.has(channelId)) {
        await this.stopLocal(channelId, { logout });
      } else if (logout) {
        // Ninguém conectado: basta apagar o pareamento guardado.
        const session = await this.prisma.whatsAppSession.findUnique({ where: { channelId } });
        await this.authState.clear(channelId);
        await this.publishQrCode(channelId, null);
        if (session) {
          await this.reporter.connection(session, 'logged_out', { reason: 'requested' });
        }
      }
    });
  }

  /**
   * Canal removido: encerra a sessão (se estiver aqui) e apaga o estado
   * desejado e as credenciais. A instância dona é quem executa.
   */
  async purge(channelId: string): Promise<void> {
    await this.serialized(async () => {
      if (!this.sessions.has(channelId) && (await this.leases.heldElsewhere(channelId))) {
        throw new SessionOwnedElsewhereError(channelId);
      }
      await this.stopLocal(channelId, { logout: true });
      await this.prisma.whatsAppSession.deleteMany({ where: { channelId } });
      await this.authState.clear(channelId);
      await this.publishQrCode(channelId, null);
      this.logger.log(`Sessão do canal ${channelId} apagada (canal removido)`);
    });
  }

  /** A sessão conectada NESTA instância (envio de mensagens). */
  connectedSession(channelId: string): WhatsAppSession | undefined {
    const session = this.sessions.get(channelId);
    return session?.isConnected ? session : undefined;
  }

  /** Um ciclo de reconciliação; se já houver um na fila, aproveita aquele. */
  reconcile(): Promise<void> {
    if (this.reconcilePending || this.shuttingDown) return Promise.resolve();
    this.reconcilePending = true;
    return this.serialized(async () => {
      this.reconcilePending = false;
      if (!this.shuttingDown) await this.runReconcile();
    }).catch((error: unknown) => this.logger.warn(`Reconciliação falhou: ${String(error)}`));
  }

  private async runReconcile(): Promise<void> {
    // 1. Sessões locais cujo lease foi perdido (ex.: Redis fora por mais de 30 s).
    for (const channelId of [...this.sessions.keys()]) {
      if (!(await this.leases.renew(channelId))) {
        this.logger.warn(`Lease perdido para o canal ${channelId}; encerrando localmente`);
        const session = this.sessions.get(channelId);
        this.sessions.delete(channelId);
        await session?.stop({ logout: false });
      }
    }

    const wanted = await this.prisma.whatsAppSession.findMany({
      where: { desiredState: 'active' },
      select: { channelId: true, tenantId: true },
    });
    const wantedIds = new Set(wanted.map((s) => s.channelId));

    // 2. Sessões locais que não devem mais existir.
    for (const channelId of [...this.sessions.keys()]) {
      if (!wantedIds.has(channelId)) await this.stopLocal(channelId, { logout: false });
    }

    // 3. Sessões desejadas sem dono.
    for (const { channelId, tenantId } of wanted) {
      if (this.sessions.has(channelId)) continue;
      if (!(await this.leases.acquire(channelId))) continue; // outra instância cuida
      this.startLocal(channelId, tenantId);
    }
  }

  private startLocal(channelId: string, tenantId: string): void {
    const ref = { channelId, tenantId };
    const session: WhatsAppSession = new WhatsAppSession(channelId, tenantId, {
      logger: this.baileysLogger.child({ channelId }),
      loadAuthState: () => this.authState.load(channelId),
      clearAuthState: () => this.authState.clear(channelId),
      onStatus: (status, details) => this.reporter.connection(ref, status, details),
      onQrCode: (qr) => this.publishQrCode(channelId, qr),
      onMessage: (message) => this.reporter.message(ref, message),
      // Logout pelo celular ou QR não escaneado: não tentar de novo até
      // alguém pedir para conectar (novo StartWhatsAppSession).
      onGaveUp: () =>
        this.serialized(async () => {
          await this.setDesired(channelId, null, 'inactive');
          await this.forget(channelId, session);
        }),
    });
    this.sessions.set(channelId, session);
    this.logger.log(`Assumindo a sessão do canal ${channelId}`);

    session.start().catch((error: unknown) => {
      this.logger.error(`Falha ao iniciar o canal ${channelId}: ${String(error)}`);
      void this.forget(channelId, session); // o próximo ciclo tenta de novo
    });
  }

  private async stopLocal(channelId: string, options: { logout: boolean }): Promise<void> {
    const session = this.sessions.get(channelId);
    if (!session) return;
    this.sessions.delete(channelId);
    await session.stop(options);
    await this.leases.release(channelId);
  }

  /** Tira do mapa (se ainda for a mesma sessão) e libera o lease. */
  private async forget(channelId: string, session: WhatsAppSession): Promise<void> {
    if (this.sessions.get(channelId) !== session) return;
    this.sessions.delete(channelId);
    await this.leases.release(channelId);
  }

  private async setDesired(
    channelId: string,
    tenantId: string | null,
    desiredState: 'active' | 'inactive',
  ): Promise<void> {
    const updatedAt = new Date();
    if (tenantId) {
      await this.prisma.whatsAppSession.upsert({
        where: { channelId },
        create: { channelId, tenantId, desiredState, updatedAt },
        update: { desiredState, updatedAt },
      });
    } else {
      await this.prisma.whatsAppSession.updateMany({
        where: { channelId },
        data: { desiredState, updatedAt },
      });
    }
  }

  private async publishQrCode(channelId: string, qr: string | null): Promise<void> {
    const key = whatsAppQrCodeKey(channelId);
    try {
      if (qr) await this.redis.set(key, qr, 'EX', WHATSAPP_QR_TTL_SECONDS);
      else await this.redis.del(key);
    } catch (error) {
      this.logger.warn(`Não foi possível publicar o QR do canal ${channelId}: ${String(error)}`);
    }
  }

  /** Executa `task` depois de tudo que já está na fila desta instância. */
  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(task, task);
    this.tail = run.catch(() => undefined);
    return run;
  }
}

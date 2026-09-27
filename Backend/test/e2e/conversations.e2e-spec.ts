import { getQueueToken } from '@nestjs/bullmq';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import { AppConfigModule } from '../../src/config/app-config.module';
import {
  WHATSAPP_CONNECTOR_QUEUE,
  WHATSAPP_EVENTS_QUEUE,
  WhatsAppMessageReceived,
} from '../../src/contracts/whatsapp-connector.contract';
import { AccountsModule } from '../../src/modules/accounts';
import { ChannelsWorkerModule } from '../../src/modules/channels';
import { ContactsModule } from '../../src/modules/contacts';
import { ConversationsModule } from '../../src/modules/conversations';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../src/modules/conversations/application/ports/conversation.repository';
import {
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from '../../src/modules/conversations/application/ports/message.repository';
import { Conversation } from '../../src/modules/conversations/domain/conversation.entity';
import { Message } from '../../src/modules/conversations/domain/message.entity';
import { IdentityModule } from '../../src/modules/identity';
import { JOB_QUEUE, type JobPayload, type JobQueue } from '../../src/shared/application/job-queue';
import type { AppClsStore } from '../../src/shared/infra/context/app-cls-store';
import { DOMAIN_EVENTS_QUEUE } from '../../src/shared/infra/events/domain-event-jobs';
import { OutboxWorkerModule } from '../../src/shared/infra/events/outbox-worker.module';
import { PrismaModule } from '../../src/shared/infra/prisma/prisma.module';
import { PrismaService } from '../../src/shared/infra/prisma/prisma.service';
import { SharedInfraModule } from '../../src/shared/infra/shared-infra.module';

async function waitFor(condition: () => Promise<boolean>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('timeout esperando a condição');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Do relato do conector até a conversa gravada, com Postgres e Redis reais:
 * fila whatsapp-events → módulo channels → outbox → módulo conversations.
 * O Baileys é o único pedaço de fora (o teste faz o papel dele).
 */
describe('Conversas (Postgres e Redis reais)', () => {
  let app: TestingModule;
  let prisma: PrismaService;
  const tenantId = randomUUID();
  const channelId = randomUUID();

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        AppConfigModule,
        PrismaModule,
        SharedInfraModule,
        OutboxWorkerModule,
        IdentityModule,
        AccountsModule,
        ContactsModule,
        ConversationsModule,
        ChannelsWorkerModule,
      ],
    }).compile();
    await app.init();
    prisma = app.get(PrismaService);

    const now = new Date();
    await prisma.channel.create({
      data: {
        id: channelId,
        tenantId,
        provider: 'whatsapp_baileys',
        name: 'E2E',
        status: 'connected',
        createdAt: now,
        statusAt: now,
      },
    });
  });

  afterAll(async () => {
    await prisma.message.deleteMany({ where: { tenantId } });
    await prisma.conversation.deleteMany({ where: { tenantId } });
    await prisma.contact.deleteMany({ where: { tenantId } });
    await prisma.channel.deleteMany({ where: { tenantId } });
    await prisma.outboxEvent.deleteMany({ where: { tenantId } });
    for (const queue of [WHATSAPP_EVENTS_QUEUE, WHATSAPP_CONNECTOR_QUEUE, DOMAIN_EVENTS_QUEUE]) {
      await app.get<Queue>(getQueueToken(queue)).obliterate({ force: true });
    }
    await app.close();
  });

  /** Executa no contexto do tenant, como um job ou requisição faria. */
  function inTenant<T>(work: () => Promise<T>): Promise<T> {
    const cls = app.get<ClsService<AppClsStore>>(ClsService);
    return cls.run(() => {
      cls.set('tenantId', tenantId);
      return work();
    });
  }

  /** Faz o papel do conector: relata uma mensagem recebida. */
  function connectorReports(message: Partial<JobPayload<typeof WhatsAppMessageReceived>>) {
    return inTenant(() =>
      app.get<JobQueue>(JOB_QUEUE).add(WhatsAppMessageReceived, {
        channelId,
        tenantId,
        externalId: 'WA-1',
        contactPhone: '+5511900000001',
        contactJid: '5511900000001@s.whatsapp.net',
        contactName: 'Cliente E2E',
        fromMe: false,
        kind: 'text',
        text: 'Oi, preciso de ajuda',
        sentAt: new Date().toISOString(),
        ...message,
      }),
    );
  }

  /** Filas vazias = tudo que foi enfileirado já foi processado. */
  async function queuesDrained(): Promise<boolean> {
    for (const name of [WHATSAPP_EVENTS_QUEUE, DOMAIN_EVENTS_QUEUE]) {
      const counts = await app
        .get<Queue>(getQueueToken(name))
        .getJobCounts('waiting', 'active', 'delayed', 'prioritized');
      if (Object.values(counts).some((n) => n > 0)) return false;
    }
    const pending = await prisma.outboxEvent.count({ where: { tenantId, publishedAt: null } });
    return pending === 0;
  }

  it('a message reported by the connector becomes contact + conversation + message', async () => {
    await connectorReports({});

    await waitFor(async () => (await prisma.message.count({ where: { tenantId } })) === 1);

    const conversation = await prisma.conversation.findFirstOrThrow({ where: { tenantId } });
    expect(conversation).toMatchObject({
      channelId,
      status: 'open',
      unreadCount: 1,
      lastMessagePreview: 'Oi, preciso de ajuda',
    });
    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId } });
    expect(contact).toMatchObject({ phone: '+5511900000001', name: 'Cliente E2E' });
    expect(conversation.contactId).toBe(contact.id);
  });

  it('a duplicated delivery is recorded once; the next message joins the same conversation', async () => {
    await connectorReports({}); // mesma WA-1 de novo (webhook duplicado)
    await connectorReports({ externalId: 'WA-2', text: 'alguém?' });

    await waitFor(queuesDrained);

    expect(await prisma.message.count({ where: { tenantId } })).toBe(2);
    expect(await prisma.conversation.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.contact.count({ where: { tenantId } })).toBe(1);
  });

  it('the chat is ordered by send time, not by arrival (also across pages)', async () => {
    const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();
    // Chegou por último, mas foi enviada antes de WA-1 e WA-2 (ex.: celular offline).
    await connectorReports({
      externalId: 'WA-0',
      text: 'enviada primeiro',
      sentAt: minutesAgo(60),
    });
    await waitFor(queuesDrained);

    const repository = app.get<MessageRepository>(MESSAGE_REPOSITORY, { strict: false });
    const conversation = await prisma.conversation.findFirstOrThrow({ where: { tenantId } });
    const texts: (string | null)[] = [];
    let cursor: string | undefined;
    do {
      const page = await inTenant(() =>
        repository.listByConversation(conversation.id, { limit: 1, cursor }),
      );
      texts.push(...page.items.map((m) => m.text));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);

    // Mais recentes primeiro: a enviada há 1 hora fica por último.
    expect(texts).toEqual(['alguém?', 'Oi, preciso de ajuda', 'enviada primeiro']);
  });

  it('the inbox paginates by last message and respects the member scope', async () => {
    const repository = app.get<ConversationRepository>(CONVERSATION_REPOSITORY, { strict: false });
    const base = new Date('2020-01-01T10:00:00Z').getTime(); // antes de "agora"

    // Três conversas extras: minha, de um colega e sem responsável, em horários diferentes.
    await inTenant(async () => {
      for (const [minute, assignee] of [
        [1, 'mine'],
        [2, 'colleague'],
        [3, null],
      ] as const) {
        const conversation = Conversation.start(randomUUID(), {
          tenantId,
          channelId,
          contactId: randomUUID(),
        });
        conversation.addMessage(
          Message.inbound(randomUUID(), {
            tenantId,
            conversationId: conversation.id,
            channelId,
            externalId: `WA-extra-${minute}`,
            kind: 'text',
            text: `minuto ${minute}`,
            sentAt: new Date(base + minute * 60_000),
          }),
        );
        conversation.assign(assignee && (assignee === 'mine' ? MINE : COLLEAGUE));
        await repository.save(conversation);
      }
    });

    const all = await inTenant(async () => {
      const first = await repository.list({ scope: { kind: 'all' }, limit: 2 });
      const second = await repository.list({
        scope: { kind: 'all' },
        limit: 2,
        cursor: first.nextCursor ?? undefined,
      });
      return { first, second };
    });
    const previews = [...all.first.items, ...all.second.items].map((c) => c.lastMessagePreview);
    // A conversa do teste anterior é a mais recente (agora), depois 3, 2, 1 minutos.
    expect(previews).toEqual(['alguém?', 'minuto 3', 'minuto 2', 'minuto 1']);
    expect(all.second.nextCursor).toBeNull();

    const own = await inTenant(() =>
      repository.list({ scope: { kind: 'own', membershipId: MINE }, limit: 10 }),
    );
    expect(own.items.map((c) => c.lastMessagePreview)).toEqual([
      'alguém?', // sem responsável
      'minuto 3', // sem responsável
      'minuto 1', // minha
    ]);
  });
});

const MINE = randomUUID();
const COLLEAGUE = randomUUID();

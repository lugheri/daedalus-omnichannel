import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { OutboxRecord, OutboxStore } from './outbox-store';

interface Row {
  id: string;
  event_name: string;
  tenant_id: string | null;
  correlation_id: string | null;
  payload: Record<string, unknown>;
}

@Injectable()
export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly prisma: PrismaService) {}

  claim(limit: number, deliver: (records: OutboxRecord[]) => Promise<void>): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      // SKIP LOCKED: várias réplicas do worker dividem o trabalho sem se
      // bloquearem e sem pegar o mesmo evento.
      const rows = await tx.$queryRaw<Row[]>`
        SELECT id, event_name, tenant_id, correlation_id, payload
        FROM platform.outbox_events
        WHERE published_at IS NULL
        ORDER BY occurred_at, id
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`;
      if (rows.length === 0) return 0;

      await deliver(
        rows.map((row) => ({
          id: row.id,
          eventName: row.event_name,
          tenantId: row.tenant_id,
          correlationId: row.correlation_id,
          payload: row.payload,
        })),
      );

      const ids = rows.map((row) => row.id);
      await tx.$executeRaw`
        UPDATE platform.outbox_events SET published_at = now() WHERE id = ANY(${ids}::uuid[])`;
      return rows.length;
    });
  }
}

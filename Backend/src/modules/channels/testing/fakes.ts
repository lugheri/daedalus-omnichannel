import type { TenantContext } from '../../../shared/application/tenant-context';
import type { ChannelRepository } from '../application/ports/channel.repository';
import type { QrCodeReader } from '../application/ports/qr-code-reader';
import type { Channel } from '../domain/channel.entity';

/** Reproduz o repositório real: isolado por tenant. */
export class InMemoryChannelRepository implements ChannelRepository {
  private items: Channel[] = [];

  constructor(private readonly tenant: TenantContext) {}

  save(channel: Channel): Promise<void> {
    this.items = [...this.items.filter((c) => c.id !== channel.id), channel];
    return Promise.resolve();
  }

  findById(id: string): Promise<Channel | null> {
    const tenantId = this.tenant.tenantId;
    return Promise.resolve(this.items.find((c) => c.id === id && c.tenantId === tenantId) ?? null);
  }

  findByIds(ids: string[]): Promise<Channel[]> {
    const tenantId = this.tenant.tenantId;
    return Promise.resolve(this.items.filter((c) => ids.includes(c.id) && c.tenantId === tenantId));
  }

  list(): Promise<Channel[]> {
    const tenantId = this.tenant.tenantId;
    return Promise.resolve(this.items.filter((c) => c.tenantId === tenantId));
  }

  delete(channel: Channel): Promise<void> {
    const tenantId = this.tenant.tenantId;
    this.items = this.items.filter((c) => !(c.id === channel.id && c.tenantId === tenantId));
    return Promise.resolve();
  }
}

export class FakeQrCodeReader implements QrCodeReader {
  readonly codes = new Map<string, string>();

  read(channelId: string): Promise<string | null> {
    return Promise.resolve(this.codes.get(channelId) ?? null);
  }
}

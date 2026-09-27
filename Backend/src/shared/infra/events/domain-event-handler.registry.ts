import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { DOMAIN_EVENT_HANDLER } from '../../application/domain-event-handler';

type Invoke = (event: Record<string, unknown>) => Promise<unknown>;

/**
 * Descobre, na inicialização, todos os métodos marcados com
 * @HandlesDomainEvent nos providers da aplicação. O id de cada consumidor
 * (`Classe.metodo`) entra no id do job de entrega — renomear um handler
 * muda esse id.
 */
@Injectable()
export class DomainEventHandlerRegistry implements OnModuleInit {
  private readonly logger = new Logger(DomainEventHandlerRegistry.name);
  private readonly byEvent = new Map<string, string[]>();
  private readonly byId = new Map<string, Invoke>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    for (const wrapper of this.discovery.getProviders()) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      if (!instance || typeof instance !== 'object') continue;
      const prototype = Object.getPrototypeOf(instance) as object;

      for (const method of this.scanner.getAllMethodNames(prototype)) {
        const target = instance[method];
        if (typeof target !== 'function') continue;
        const eventName = this.reflector.get<string | undefined>(DOMAIN_EVENT_HANDLER, target);
        if (!eventName) continue;

        const id = `${instance.constructor.name}.${method}`;
        this.byId.set(id, (event) => Promise.resolve(target.call(instance, event)));
        this.byEvent.set(eventName, [...(this.byEvent.get(eventName) ?? []), id]);
      }
    }
    this.logger.log(`${this.byId.size} consumidor(es) de eventos de domínio registrado(s)`);
  }

  handlersFor(eventName: string): readonly string[] {
    return this.byEvent.get(eventName) ?? [];
  }

  invoke(handlerId: string, event: Record<string, unknown>): Promise<unknown> {
    const invoke = this.byId.get(handlerId);
    if (!invoke) throw new Error(`Unknown domain event handler "${handlerId}"`);
    return invoke(event);
  }
}

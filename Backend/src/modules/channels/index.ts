/**
 * API pública do módulo channels. Outros módulos só podem importar daqui.
 */
export { ChannelsFacade, type ChannelSummary } from './application/channels.facade';
export { ChannelsModule } from './channels.module';
export { ChannelsWorkerModule } from './channels.worker.module';
export type { ChannelStatus } from './domain/channel.entity';
export {
  ChannelMessageReceivedEvent,
  ChannelMessageSendResultEvent,
  ChannelRemovedEvent,
  ChannelStatusChangedEvent,
  type MessageKind,
} from './domain/events/channel-events';

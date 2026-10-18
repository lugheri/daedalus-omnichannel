/**
 * API pública do módulo channels. Outros módulos só podem importar daqui.
 */
export {
  ChannelsFacade,
  type ChannelSummary,
  type WebChatChannel,
} from './application/channels.facade';
export { MAX_WEB_CHAT_TEXT } from './application/use-cases/web-chat.use-cases';
export { WEB_CHAT_MESSAGE_EVENT } from './application/channel-sender';
export { ChannelsModule } from './channels.module';
export { ChannelsWorkerModule } from './channels.worker.module';
export type { ChannelProvider, ChannelStatus, WebChatSettings } from './domain/channel.entity';
export {
  ChannelMessageReceivedEvent,
  type ChannelMedia,
  ChannelMessageSendResultEvent,
  ChannelRemovedEvent,
  ChannelStatusChangedEvent,
  type MessageKind,
} from './domain/events/channel-events';

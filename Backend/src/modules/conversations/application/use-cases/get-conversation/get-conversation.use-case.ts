import { Inject, Injectable } from '@nestjs/common';
import { toViews, type ConversationView } from '../../conversation-view';
import { CHANNEL_GATEWAY, type ChannelGateway } from '../../ports/channel-gateway';
import { CONTACT_DIRECTORY, type ContactDirectory } from '../../ports/contact-directory';
import { VisibleConversations } from '../../visible-conversations';

@Injectable()
export class GetConversationUseCase {
  constructor(
    @Inject(CONTACT_DIRECTORY) private readonly contacts: ContactDirectory,
    @Inject(CHANNEL_GATEWAY) private readonly channels: ChannelGateway,
    private readonly visible: VisibleConversations,
  ) {}

  async execute(id: string): Promise<ConversationView> {
    const { conversation } = await this.visible.load(id);
    const [view] = await toViews([conversation], this.contacts, this.channels);
    return view;
  }
}

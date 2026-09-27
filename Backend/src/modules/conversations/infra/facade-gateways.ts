import { Injectable } from '@nestjs/common';
import { AccountsFacade } from '../../accounts';
import { ChannelsFacade } from '../../channels';
import { ContactsFacade } from '../../contacts';
import type { ChannelGateway, ChannelInfo } from '../application/ports/channel-gateway';
import type { ContactDirectory, ContactInfo } from '../application/ports/contact-directory';
import type { CurrentMember, MemberAccess } from '../application/ports/member-access';

/** Adapters dos ports de conversations sobre as APIs públicas dos outros módulos. */

@Injectable()
export class ContactsFacadeDirectory implements ContactDirectory {
  constructor(private readonly contacts: ContactsFacade) {}

  findById(id: string): Promise<ContactInfo | null> {
    return this.contacts.findById(id);
  }

  findByIds(ids: string[]): Promise<ContactInfo[]> {
    return this.contacts.findByIds(ids);
  }

  findOrCreateByPhone(input: { phone: string; name: string | null }): Promise<ContactInfo> {
    return this.contacts.findOrCreateByPhone(input);
  }
}

@Injectable()
export class ChannelsFacadeGateway implements ChannelGateway {
  constructor(private readonly channels: ChannelsFacade) {}

  findByIds(ids: string[]): Promise<ChannelInfo[]> {
    return this.channels.findByIds(ids);
  }

  assertCanSend(channelId: string): Promise<void> {
    return this.channels.assertCanSend(channelId);
  }

  sendText(input: { channelId: string; messageId: string; to: string; text: string }) {
    return this.channels.sendText(input);
  }
}

@Injectable()
export class AccountsFacadeMemberAccess implements MemberAccess {
  constructor(private readonly accounts: AccountsFacade) {}

  current(): Promise<CurrentMember> {
    return this.accounts.currentMember();
  }
}

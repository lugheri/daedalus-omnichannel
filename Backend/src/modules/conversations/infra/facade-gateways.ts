import { Injectable } from '@nestjs/common';
import { AccountsFacade } from '../../accounts';
import { ChannelsFacade } from '../../channels';
import { ContactsFacade } from '../../contacts';
import { TeamsFacade } from '../../teams';
import type { ChannelGateway, ChannelInfo } from '../application/ports/channel-gateway';
import type { ContactDirectory, ContactInfo } from '../application/ports/contact-directory';
import type { CurrentMember, MemberAccess } from '../application/ports/member-access';
import type { TeamDirectory, TeamInfo } from '../application/ports/team-directory';

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
export class FacadesMemberAccess implements MemberAccess {
  constructor(
    private readonly accounts: AccountsFacade,
    private readonly teams: TeamsFacade,
  ) {}

  async current(): Promise<CurrentMember> {
    const member = await this.accounts.currentMember();
    return { ...member, teamIds: await this.teams.teamIdsOf(member.membershipId) };
  }

  activeMemberIds(ids: string[]): Promise<string[]> {
    return this.accounts.activeMemberIds(ids);
  }
}

@Injectable()
export class TeamsFacadeDirectory implements TeamDirectory {
  constructor(private readonly teams: TeamsFacade) {}

  findByIds(ids: string[]): Promise<TeamInfo[]> {
    return this.teams.findByIds(ids);
  }

  exists(teamId: string): Promise<boolean> {
    return this.teams.exists(teamId);
  }
}

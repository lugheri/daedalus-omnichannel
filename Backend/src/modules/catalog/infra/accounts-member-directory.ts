import { Injectable } from '@nestjs/common';
import { AccountsFacade } from '../../accounts';
import type { MemberDirectory } from '../application/ports/member-directory';

/** Adapter do port MemberDirectory sobre a API pública do accounts. */
@Injectable()
export class AccountsMemberDirectory implements MemberDirectory {
  constructor(private readonly accounts: AccountsFacade) {}

  activeMemberIds(ids: string[]): Promise<string[]> {
    return this.accounts.activeMemberIds(ids);
  }
}

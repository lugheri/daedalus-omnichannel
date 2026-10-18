import { Injectable } from '@nestjs/common';
import type { PlanLimit } from '../../../shared/domain/plan-entitlement';
import { AccountsFacade } from '../../accounts';
import { ChannelsFacade } from '../../channels';
import { FormsFacade } from '../../forms';
import { SitesFacade } from '../../sites';
import type { CurrentPlan, UsageSources } from '../application/ports/usage-sources';

@Injectable()
export class FacadeUsageSources implements UsageSources {
  constructor(
    private readonly accounts: AccountsFacade,
    private readonly channels: ChannelsFacade,
    private readonly forms: FormsFacade,
    private readonly sites: SitesFacade,
  ) {}

  async plan(): Promise<CurrentPlan> {
    const { plan, unlimited } = await this.accounts.currentPlan();
    return {
      id: plan?.id ?? null,
      name: unlimited ? null : (plan?.name ?? null),
      description: unlimited ? null : (plan?.description ?? null),
      unlimited,
      limits: plan && !unlimited ? plan.limits : allUnlimited(),
      features: plan && !unlimited ? plan.features : allIncluded(),
    };
  }

  async usage(): Promise<Record<PlanLimit, number>> {
    const [accounts, channels, forms, landingPages] = await Promise.all([
      this.accounts.planUsage(),
      this.channels.countByKind(),
      this.forms.count(),
      this.sites.landingPagesCount(),
    ]);
    return {
      members: accounts.members,
      childAccounts: accounts.childAccounts,
      whatsappChannels: channels.whatsapp,
      webChatChannels: channels.webChat,
      forms,
      landingPages,
    };
  }
}

const allUnlimited = (): CurrentPlan['limits'] => ({
  members: null,
  whatsappChannels: null,
  webChatChannels: null,
  forms: null,
  landingPages: null,
  childAccounts: null,
});
const allIncluded = (): CurrentPlan['features'] => ({
  campaigns: true,
  automations: true,
  onlineBooking: true,
  abTesting: true,
});

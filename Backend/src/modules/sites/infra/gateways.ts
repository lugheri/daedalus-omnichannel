import { Inject, Injectable } from '@nestjs/common';
import { AccountsFacade } from '../../accounts';
import { CatalogFacade } from '../../catalog';
import { FormsFacade } from '../../forms';
import type {
  SiteAccount,
  SiteFormInfo,
  SiteProfessionalItem,
  SiteServiceItem,
  SiteSources,
} from '../application/ports/site-sources';
import { SITES_SETTINGS, type SitesSettings } from './sites-settings';

/** Catálogo e formulários (outros módulos), pelas facades deles. */
@Injectable()
export class FacadeSiteSources implements SiteSources {
  constructor(
    private readonly catalog: CatalogFacade,
    private readonly forms: FormsFacade,
    @Inject(SITES_SETTINGS) private readonly settings: SitesSettings,
  ) {}

  services(): Promise<SiteServiceItem[]> {
    return this.catalog.siteOfferings();
  }

  professionals(): Promise<SiteProfessionalItem[]> {
    return this.catalog.siteProfessionals();
  }

  async form(id: string): Promise<SiteFormInfo | null> {
    const form = await this.forms.siteForm(id);
    if (!form) return null;
    return { actionUrl: `${this.settings.publicApiUrl}${form.actionPath}`, kind: form.kind };
  }
}

@Injectable()
export class AccountsSiteAccount implements SiteAccount {
  constructor(private readonly accounts: AccountsFacade) {}

  current() {
    return this.accounts.currentAccount();
  }

  actingFromParentAccount() {
    return this.accounts.actingFromParentAccount();
  }
}

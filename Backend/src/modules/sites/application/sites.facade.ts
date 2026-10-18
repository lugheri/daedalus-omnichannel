import { Inject, Injectable } from '@nestjs/common';
import {
  LANDING_PAGE_REPOSITORY,
  type LandingPageRepository,
} from './ports/landing-page.repository';

/** API do módulo sites para outros módulos. */
@Injectable()
export class SitesFacade {
  constructor(
    @Inject(LANDING_PAGE_REPOSITORY) private readonly landingPages: LandingPageRepository,
  ) {}

  /** Quantas landing pages a conta atual tem (o uso do plano). */
  landingPagesCount(): Promise<number> {
    return this.landingPages.count();
  }
}

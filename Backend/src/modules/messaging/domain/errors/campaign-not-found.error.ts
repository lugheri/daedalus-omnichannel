import { NotFoundError } from '../../../../shared/domain/domain-error';

export class CampaignNotFoundError extends NotFoundError {
  readonly code = 'CAMPAIGN_NOT_FOUND';

  constructor() {
    super('Campaign not found');
  }
}

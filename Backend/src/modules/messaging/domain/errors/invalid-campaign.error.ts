import { DomainError } from '../../../../shared/domain/domain-error';

export type InvalidCampaignCode =
  | 'CAMPAIGN_INVALID_NAME'
  | 'CAMPAIGN_INVALID_SUBJECT'
  | 'CAMPAIGN_INVALID_BODY'
  | 'CAMPAIGN_INVALID_SCHEDULE'
  | 'CAMPAIGN_NOT_EDITABLE'
  | 'CAMPAIGN_NOT_CANCELABLE';

/** Regra da campanha violada (422). */
export class InvalidCampaignError extends DomainError {
  constructor(readonly code: InvalidCampaignCode) {
    super(`Invalid campaign: ${code}`);
  }
}

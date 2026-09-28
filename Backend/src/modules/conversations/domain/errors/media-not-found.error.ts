import { NotFoundError } from '../../../../shared/domain/domain-error';

export class MediaNotFoundError extends NotFoundError {
  readonly code = 'MEDIA_NOT_FOUND';

  constructor() {
    super('Media not found');
  }
}

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * O guard padrão do throttler, só com o corpo do 429 no formato da API
 * (`{ code, message }`). O header `Retry-After` continua sendo enviado.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(): Promise<void> {
    throw new HttpException(
      { code: 'RATE_LIMITED', message: 'Too many requests, try again later' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

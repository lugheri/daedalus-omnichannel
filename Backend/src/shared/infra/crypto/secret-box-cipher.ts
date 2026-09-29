import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import type { SecretCipher } from '../../application/secret-cipher';
import { SecretBox } from './secret-box';

/** Adapter do SecretCipher sobre o SecretBox (AES-256-GCM, ENCRYPTION_KEY). */
@Injectable()
export class SecretBoxCipher implements SecretCipher {
  private readonly box: SecretBox;

  constructor(config: AppConfig) {
    this.box = new SecretBox(config.encryptionKey);
  }

  seal(plaintext: string): string {
    return this.box.seal(plaintext).toString('base64');
  }

  open(sealed: string): string {
    return this.box.openText(Buffer.from(sealed, 'base64'));
  }
}

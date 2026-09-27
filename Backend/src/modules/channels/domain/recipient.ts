import { normalizePhoneNumber } from '../../../shared/domain/phone-number';
import { InvalidRecipientError } from './errors/invalid-recipient.error';

/**
 * Destinatário de um envio, normalizado para E.164 (+5511987654321). Aceita a
 * forma digitada (`(11) 98765-4321` assume +55) — ver normalizePhoneNumber.
 */
export function normalizeRecipient(raw: string): string {
  const normalized = normalizePhoneNumber(raw);
  if (!normalized) throw new InvalidRecipientError();
  return normalized;
}

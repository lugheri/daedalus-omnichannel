import { formatPhone } from '@/lib/phone'
import type { Contact } from './api'

export type PickedContact = Pick<Contact, 'id' | 'name' | 'phone' | 'email'>

/** Nome, ou telefone, ou e-mail. */
export function contactLabel(contact: PickedContact | null): string {
  if (!contact) return 'Contato'
  return contact.name ?? (contact.phone ? formatPhone(contact.phone) : (contact.email ?? 'Contato'))
}

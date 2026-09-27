import { Contact, Home, KeyRound, Users, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Visível para quem tiver ao menos uma destas permissões (vazio = todos). */
  anyOf: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: Home, anyOf: [] },
  { to: '/contacts', label: 'Contatos', icon: Contact, anyOf: ['contacts:view'] },
  { to: '/settings/members', label: 'Membros', icon: Users, anyOf: ['members:manage'] },
  {
    to: '/settings/roles',
    label: 'Cargos',
    icon: KeyRound,
    anyOf: ['roles:manage', 'members:manage'],
  },
]

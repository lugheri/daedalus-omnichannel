import {
  Contact,
  Home,
  Inbox,
  KeyRound,
  MessageCircle,
  Network,
  Plug,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Visível para quem tiver ao menos uma destas permissões (vazio = todos). */
  anyOf: string[]
}

/** Qualquer escopo de conversa dá acesso à caixa de entrada (a API filtra o que cada um vê). */
export const CONVERSATION_SCOPES = [
  'conversations:view:own',
  'conversations:view:team',
  'conversations:view:all',
]

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: Home, anyOf: [] },
  { to: '/conversations', label: 'Conversas', icon: Inbox, anyOf: CONVERSATION_SCOPES },
  { to: '/contacts', label: 'Contatos', icon: Contact, anyOf: ['contacts:view'] },
  { to: '/settings/channels', label: 'Canais', icon: MessageCircle, anyOf: ['channels:manage'] },
  {
    to: '/settings/dispositions',
    label: 'Tabulações',
    icon: Tags,
    anyOf: ['dispositions:manage'],
  },
  { to: '/settings/teams', label: 'Equipes', icon: Network, anyOf: ['teams:manage'] },
  { to: '/settings/members', label: 'Membros', icon: Users, anyOf: ['members:manage'] },
  {
    to: '/settings/roles',
    label: 'Cargos',
    icon: KeyRound,
    anyOf: ['roles:manage', 'members:manage'],
  },
  {
    to: '/settings/integrations',
    label: 'Integrações',
    icon: Plug,
    anyOf: ['integrations:manage'],
  },
]

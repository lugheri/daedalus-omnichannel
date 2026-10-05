import {
  Contact,
  Headset,
  Home,
  Inbox,
  KeyRound,
  Mail,
  Megaphone,
  MessageCircle,
  Network,
  Plug,
  Settings,
  SquareKanban,
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

export interface NavGroup {
  /** `null` = itens soltos, sem título de grupo. */
  label: string | null
  items: NavItem[]
}

/** Módulo = um botão do trilho; as telas dele aparecem no painel ao lado. */
export interface NavModule {
  key: string
  label: string
  icon: LucideIcon
  description: string
  groups: NavGroup[]
}

/** Qualquer escopo de conversa dá acesso à caixa de entrada (a API filtra o que cada um vê). */
export const CONVERSATION_SCOPES = [
  'conversations:view:own',
  'conversations:view:team',
  'conversations:view:all',
]

export const NAV_MODULES: NavModule[] = [
  {
    key: 'home',
    label: 'Início',
    icon: Home,
    description: 'Visão geral da conta',
    groups: [{ label: null, items: [{ to: '/', label: 'Início', icon: Home, anyOf: [] }] }],
  },
  {
    key: 'service',
    label: 'Atendimento',
    icon: Headset,
    description: 'Conversas, quadros e contatos',
    groups: [
      {
        label: null,
        items: [
          { to: '/conversations', label: 'Conversas', icon: Inbox, anyOf: CONVERSATION_SCOPES },
          { to: '/boards', label: 'Quadros', icon: SquareKanban, anyOf: CONVERSATION_SCOPES },
          { to: '/contacts', label: 'Contatos', icon: Contact, anyOf: ['contacts:view'] },
        ],
      },
    ],
  },
  {
    key: 'campaigns',
    label: 'Campanhas',
    icon: Megaphone,
    description: 'E-mail e SMS em massa',
    groups: [
      {
        label: null,
        items: [
          { to: '/campaigns', label: 'Campanhas', icon: Megaphone, anyOf: ['campaigns:manage'] },
        ],
      },
    ],
  },
  {
    key: 'settings',
    label: 'Configurações',
    icon: Settings,
    description: 'Canais, tabulações e integrações',
    groups: [
      {
        label: 'Canais',
        items: [
          {
            to: '/settings/channels',
            label: 'WhatsApp',
            icon: MessageCircle,
            anyOf: ['channels:manage'],
          },
          {
            to: '/settings/messaging',
            label: 'E-mail e SMS',
            icon: Mail,
            anyOf: ['messaging:manage'],
          },
        ],
      },
      {
        label: 'Atendimento',
        items: [
          {
            to: '/settings/dispositions',
            label: 'Tabulações',
            icon: Tags,
            anyOf: ['dispositions:manage'],
          },
        ],
      },
      {
        label: 'Sistema',
        items: [
          {
            to: '/settings/integrations',
            label: 'Integrações',
            icon: Plug,
            anyOf: ['integrations:manage'],
          },
        ],
      },
    ],
  },
  {
    key: 'people',
    label: 'Pessoas e acesso',
    icon: Users,
    description: 'Membros, equipes e cargos',
    groups: [
      {
        label: null,
        items: [
          { to: '/settings/members', label: 'Membros', icon: Users, anyOf: ['members:manage'] },
          { to: '/settings/teams', label: 'Equipes', icon: Network, anyOf: ['teams:manage'] },
          {
            to: '/settings/roles',
            label: 'Cargos',
            icon: KeyRound,
            anyOf: ['roles:manage', 'members:manage'],
          },
        ],
      },
    ],
  },
]

/** Os módulos com o que a pessoa pode ver: grupos e módulos vazios somem. */
export function visibleModules(canAny: (...permissions: string[]) => boolean): NavModule[] {
  return NAV_MODULES.flatMap((module) => {
    const groups = module.groups.flatMap((group) => {
      const items = group.items.filter((item) => item.anyOf.length === 0 || canAny(...item.anyOf))
      return items.length ? [{ ...group, items }] : []
    })
    return groups.length ? [{ ...module, groups }] : []
  })
}

export function itemsOf(module: NavModule): NavItem[] {
  return module.groups.flatMap((group) => group.items)
}

export interface NavLocation {
  module: NavModule
  group: NavGroup
  item: NavItem
}

/**
 * Onde a rota atual mora no menu: a tela com o caminho mais longo que é
 * prefixo do atual (`/campaigns/123` → Campanhas). `/` só bate exato.
 */
export function locate(modules: NavModule[], pathname: string): NavLocation | null {
  let best: NavLocation | null = null
  for (const module of modules) {
    for (const group of module.groups) {
      for (const item of group.items) {
        const matches =
          item.to === '/'
            ? pathname === '/'
            : pathname === item.to || pathname.startsWith(`${item.to}/`)
        if (matches && (!best || item.to.length > best.item.to.length)) {
          best = { module, group, item }
        }
      }
    }
  }
  return best
}

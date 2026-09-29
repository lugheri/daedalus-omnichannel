/**
 * Rótulos das permissões do catálogo do backend (accounts/domain/permissions.ts).
 * Permissão nova no backend = entrada nova aqui.
 */
export const PERMISSION_GROUPS: { label: string; permissions: { key: string; label: string }[] }[] =
  [
    {
      label: 'Conta',
      permissions: [
        { key: 'account:manage', label: 'Faturamento, dados e exclusão da conta (só Owner)' },
        { key: 'members:manage', label: 'Convidar, desativar e trocar o cargo de membros' },
        { key: 'roles:manage', label: 'Criar e editar cargos' },
        { key: 'teams:manage', label: 'Gerenciar equipes e filas' },
        { key: 'channels:manage', label: 'Conectar e configurar canais' },
        { key: 'dispositions:manage', label: 'Criar e editar tabulações' },
        { key: 'integrations:manage', label: 'Chaves de API (formulário do site e integrações)' },
        { key: 'reports:view', label: 'Ver relatórios' },
      ],
    },
    {
      label: 'Contatos',
      permissions: [
        { key: 'contacts:view', label: 'Ver contatos' },
        { key: 'contacts:edit', label: 'Criar e editar contatos' },
      ],
    },
    {
      label: 'Conversas',
      permissions: [
        { key: 'conversations:view:own', label: 'Ver as próprias conversas' },
        { key: 'conversations:view:team', label: 'Ver as conversas das suas equipes' },
        { key: 'conversations:view:all', label: 'Ver todas as conversas' },
        { key: 'conversations:assign', label: 'Atribuir e transferir conversas' },
      ],
    },
  ]

/** Exclusiva do cargo Owner — nunca aparece como opção em cargos editáveis. */
export const OWNER_ONLY_PERMISSION = 'account:manage'

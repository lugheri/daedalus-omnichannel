/**
 * Catálogo de permissões (ADR 0003). É fixo no código porque só tem efeito
 * se algum código a verificar: criar uma permissão = entrada aqui + checagem
 * com @RequirePermissions no endpoint.
 *
 * Formato `recurso:ação`; variantes `:own`/`:team`/`:all` indicam o escopo
 * de dados (o guard checa a permissão, o use case aplica o escopo).
 */
export const PERMISSIONS = [
  'account:manage', //          faturamento, dados e exclusão da conta
  'members:manage', //          convidar, desativar e trocar cargo de membros
  'roles:manage', //            criar e editar cargos
  'teams:manage', //            equipes e filas
  'channels:manage', //         conectar e configurar canais (WhatsApp etc.)
  'integrations:manage', //     chaves de API (formulário do site e outras integrações)
  'reports:view',
  'contacts:view',
  'contacts:edit',
  'conversations:view:own',
  'conversations:view:team',
  'conversations:view:all',
  'conversations:assign', //    atribuir e transferir conversas
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

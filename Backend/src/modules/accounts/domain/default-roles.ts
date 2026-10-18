import { PERMISSIONS, type Permission } from './permissions';

export type SystemRoleKey = 'owner' | 'admin' | 'supervisor' | 'agent' | 'parent_access';

export interface RoleTemplate {
  key: SystemRoleKey;
  name: string;
  permissions: readonly Permission[];
  /** Cargos de sistema não podem ser editados nem removidos. */
  isSystem: boolean;
}

/**
 * Cargos com que todo tenant nasce (copiados, não referenciados: cada tenant
 * pode ajustar os seus, exceto o Owner).
 */
export const DEFAULT_ROLES: readonly RoleTemplate[] = [
  {
    key: 'owner',
    name: 'Owner',
    permissions: PERMISSIONS,
    isSystem: true,
  },
  {
    key: 'admin',
    name: 'Admin',
    permissions: PERMISSIONS.filter((p) => p !== 'account:manage'),
    isSystem: false,
  },
  {
    key: 'supervisor',
    name: 'Supervisor',
    permissions: [
      'teams:manage',
      'dispositions:manage',
      'boards:manage',
      'campaigns:manage',
      'reports:view',
      'contacts:view',
      'contacts:edit',
      'conversations:view:team',
      'conversations:assign',
      'messaging:send',
      'agenda:manage',
    ],
    isSystem: false,
  },
  {
    key: 'agent',
    name: 'Agent',
    permissions: [
      'contacts:view',
      'contacts:edit',
      'conversations:view:own',
      'messaging:send',
      'agenda:manage',
    ],
    isSystem: false,
  },
];

/** O que quem vem da conta-mãe pode fazer: o mesmo que um Admin (sem excluir a conta). */
export const PARENT_ACCESS_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter(
  (p) => p !== 'account:manage',
);

/**
 * Cargo de sistema dos vínculos delegados (quem entra vindo de uma conta
 * acima). Criado na primeira entrada; não aparece na lista de cargos nem pode
 * ser dado a um membro. As permissões valem as de `PARENT_ACCESS_PERMISSIONS`
 * no momento do acesso (não as gravadas), para acompanhar o catálogo.
 */
export const PARENT_ACCESS_ROLE: RoleTemplate = {
  key: 'parent_access',
  name: 'Acesso da conta-mãe',
  permissions: PARENT_ACCESS_PERMISSIONS,
  isSystem: true,
};

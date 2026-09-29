import { PERMISSIONS, type Permission } from './permissions';

export type SystemRoleKey = 'owner' | 'admin' | 'supervisor' | 'agent';

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
      'reports:view',
      'contacts:view',
      'contacts:edit',
      'conversations:view:team',
      'conversations:assign',
    ],
    isSystem: false,
  },
  {
    key: 'agent',
    name: 'Agent',
    permissions: ['contacts:view', 'contacts:edit', 'conversations:view:own'],
    isSystem: false,
  },
];

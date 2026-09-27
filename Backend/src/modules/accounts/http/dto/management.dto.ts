import { z } from 'zod';
import { PERMISSIONS } from '../../domain/permissions';

/** Permissão desconhecida é recusada já na entrada (400), antes do domínio. */
const permissionsSchema = z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length);

export const changeMemberRoleSchema = z.object({ roleId: z.uuid() });
export type ChangeMemberRoleDto = z.infer<typeof changeMemberRoleSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().max(320),
  roleId: z.uuid(),
});
export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1).max(256),
  password: z.string().max(128),
  name: z.string().max(120).optional(),
});
export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;

export const invitationTokenQuerySchema = z.object({ token: z.string().min(1).max(256) });
export type InvitationTokenQuery = z.infer<typeof invitationTokenQuerySchema>;

export const createRoleSchema = z.object({
  name: z.string().max(50),
  permissions: permissionsSchema,
});
export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z
  .object({
    name: z.string().max(50).optional(),
    permissions: permissionsSchema.optional(),
  })
  .refine((body) => body.name !== undefined || body.permissions !== undefined, {
    message: 'Informe name e/ou permissions',
  });
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

export const idParam = z.uuid();

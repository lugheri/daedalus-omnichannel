import { z } from 'zod';

/** Só o formato; nome válido e membros ativos são regras do domínio/use case. */
export const teamNameSchema = z.object({ name: z.string().max(200) });
export type TeamNameDto = z.infer<typeof teamNameSchema>;

export const setTeamMembersSchema = z.object({ memberIds: z.array(z.uuid()).max(500) });
export type SetTeamMembersDto = z.infer<typeof setTeamMembersSchema>;

import { z } from 'zod';

/** Só o formato; o nome válido (sem espaços, tamanho) é regra do domínio. */
export const createChannelSchema = z.object({ name: z.string().max(60) });
export type CreateChannelDto = z.infer<typeof createChannelSchema>;

/** O número é validado e normalizado para E.164 pelo domínio (aceita a forma digitada). */
export const testMessageSchema = z.object({
  to: z.string().max(32),
  text: z.string().trim().min(1).max(4096),
});
export type TestMessageDto = z.infer<typeof testMessageSchema>;

export const channelTeamSchema = z.object({ teamId: z.uuid().nullable() });
export type ChannelTeamDto = z.infer<typeof channelTeamSchema>;

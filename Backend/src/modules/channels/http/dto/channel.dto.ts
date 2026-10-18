import { z } from 'zod';

/** Só o formato; o nome válido (sem espaços, tamanho) é regra do domínio. */
export const createChannelSchema = z.object({
  name: z.string().max(60),
  /** Tipo do canal (padrão: WhatsApp). */
  type: z.enum(['whatsapp', 'web_chat']).default('whatsapp'),
});
export type CreateChannelDto = z.infer<typeof createChannelSchema>;

/** O número é validado e normalizado para E.164 pelo domínio (aceita a forma digitada). */
export const testMessageSchema = z.object({
  to: z.string().max(32),
  text: z.string().trim().min(1).max(4096),
});
export type TestMessageDto = z.infer<typeof testMessageSchema>;

/** Configuração do chat do site (só o que vier muda); `rotateKey` = chave nova do widget. */
export const webChatSettingsSchema = z.object({
  title: z.string().max(200).optional(),
  greeting: z.string().max(1000).optional(),
  color: z.string().max(7).optional(),
  rotateKey: z.boolean().optional(),
});
export type WebChatSettingsDto = z.infer<typeof webChatSettingsSchema>;

export const channelTeamSchema = z.object({ teamId: z.uuid().nullable() });
export type ChannelTeamDto = z.infer<typeof channelTeamSchema>;

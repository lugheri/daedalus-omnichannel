import { z } from 'zod';

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(512),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

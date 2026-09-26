import { z } from 'zod';

export const logInSchema = z.object({
  email: z.string().max(320),
  password: z.string().max(128),
  tenantId: z.uuid().optional(),
});

export type LogInDto = z.infer<typeof logInSchema>;

import { z } from 'zod';

export const switchAccountSchema = z.object({
  tenantId: z.uuid(),
});

export type SwitchAccountDto = z.infer<typeof switchAccountSchema>;

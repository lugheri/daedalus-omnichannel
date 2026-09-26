import { z } from 'zod';

export const signUpSchema = z.object({
  accountName: z.string().max(100),
  name: z.string().max(120),
  email: z.string().max(320),
  password: z.string().max(128),
});

export type SignUpDto = z.infer<typeof signUpSchema>;

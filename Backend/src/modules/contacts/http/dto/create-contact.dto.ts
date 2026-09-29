import { z } from 'zod';

/**
 * Só o FORMATO da entrada. Se o telefone é válido, se falta identificador ou
 * se o contato já existe, quem decide é o domínio — uma única fonte da regra,
 * valendo também para contatos criados por webhook ou importação.
 */
export const createContactSchema = z.object({
  name: z.string().max(200).nullish(),
  phone: z.string().max(32).nullish(),
  email: z.string().max(320).nullish(),
  /** Cadastro manual: a origem é sempre `manual`; aqui só o detalhe (ex.: "indicação"). */
  sourceDetail: z.string().max(200).nullish(),
});

export type CreateContactDto = z.infer<typeof createContactSchema>;

/** Campo ausente = não muda; null/vazio = apaga (desde que sobre telefone ou e-mail). */
export const updateContactSchema = z.object({
  name: z.string().max(200).nullish(),
  phone: z.string().max(32).nullish(),
  email: z.string().max(320).nullish(),
});

export type UpdateContactDto = z.infer<typeof updateContactSchema>;

export const addNoteSchema = z.object({ body: z.string().max(10_000) });
export type AddNoteDto = z.infer<typeof addNoteSchema>;

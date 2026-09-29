export interface CreateContactInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Detalhe da origem (a origem do cadastro manual é sempre `manual`). */
  sourceDetail?: string | null;
}

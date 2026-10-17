import type { Form } from '../../domain/form.entity';

/** Formulários. Restrito ao tenant atual, exceto onde dito. */
export interface FormRepository {
  save(form: Form): Promise<void>;
  findById(id: string): Promise<Form | null>;
  /** Mais recentes primeiro. */
  list(): Promise<Form[]>;
  delete(form: Form): Promise<void>;
  /**
   * Pela chave pública, em QUALQUER conta: o envio do site chega sem login,
   * e é a chave que diz de qual conta ele é. Só para o envio público.
   */
  findByPublicKeyAsSystem(publicKey: string): Promise<Form | null>;
}

export const FORM_REPOSITORY = Symbol('FormRepository');

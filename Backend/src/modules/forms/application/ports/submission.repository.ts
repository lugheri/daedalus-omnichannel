import type { FormSubmission } from '../../domain/submission';

/** Envios dos formulários. Restrito ao tenant atual. Mais recentes primeiro. */
export interface SubmissionRepository {
  save(submission: FormSubmission): Promise<void>;
  listByForm(formId: string, limit: number): Promise<FormSubmission[]>;
  listByContact(contactId: string, limit: number): Promise<FormSubmission[]>;
  /** Quantos envios cada formulário recebeu (os que não aparecem: zero). */
  countByForm(formIds: string[]): Promise<Map<string, number>>;
}

export const SUBMISSION_REPOSITORY = Symbol('SubmissionRepository');

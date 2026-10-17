import { InvalidFormError } from './errors/invalid-form.error';

/** O que o visitante mandou, já limpo (os campos de contato o contacts valida). */
export interface SubmissionFields {
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  serviceId: string | null;
  preferredDate: string | null;
}

/** Um envio, como fica guardado (o nome do serviço é copiado: o histórico não muda). */
export interface FormSubmission extends SubmissionFields {
  id: string;
  tenantId: string;
  formId: string;
  contactId: string;
  serviceName: string | null;
  createdAt: Date;
}

const LIMITS: Record<keyof SubmissionFields, number> = {
  name: 120,
  phone: 40,
  email: 320,
  message: 2000,
  serviceId: 36,
  preferredDate: 100,
};

/** Tira espaços, troca vazio por null e recusa texto grande demais. */
export function cleanFields(raw: Partial<Record<keyof SubmissionFields, string | null>>) {
  const fields = {} as SubmissionFields;
  for (const key of Object.keys(LIMITS) as (keyof SubmissionFields)[]) {
    const value = raw[key]?.trim() || null;
    if (value && value.length > LIMITS[key]) throw new InvalidFormError('FORM_INVALID_FIELD');
    fields[key] = value;
  }
  return fields;
}

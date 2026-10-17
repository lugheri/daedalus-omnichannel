import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export type FormKind = 'contact' | 'service'

export interface SiteForm {
  id: string
  name: string
  kind: FormKind
  /** Vai na URL do formulário publicado. */
  publicKey: string
  /** Rótulo da origem do contato; null = o nome do formulário. */
  campaign: string | null
  /** Página de obrigado do site; null = a página padrão. */
  successUrl: string | null
  active: boolean
  createdAt: string
  /** Só na listagem. */
  submissions?: number
}

export interface FormSubmission {
  id: string
  formId: string
  contactId: string
  name: string | null
  phone: string | null
  email: string | null
  message: string | null
  serviceId: string | null
  serviceName: string | null
  preferredDate: string | null
  createdAt: string
}

export type FormInput = Pick<SiteForm, 'name' | 'campaign' | 'successUrl'>

export const formsApi = {
  list: () => api<SiteForm[]>('/v1/forms'),
  create: (input: FormInput & { kind: FormKind }) =>
    api<SiteForm>('/v1/forms', { method: 'POST', body: input }),
  /** `rotateKey`: chave nova — o HTML publicado com a antiga para de funcionar. */
  update: (id: string, input: Partial<FormInput> & { active?: boolean; rotateKey?: boolean }) =>
    api<SiteForm>(`/v1/forms/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => api<void>(`/v1/forms/${id}`, { method: 'DELETE' }),
  submissions: (id: string) => api<FormSubmission[]>(`/v1/forms/${id}/submissions`),
  /** Envios de um contato (ficha), com o nome do formulário. */
  byContact: (contactId: string) =>
    api<(FormSubmission & { formName: string })[]>('/v1/forms/submissions', {
      query: { contactId },
    }),
}

export const formKeys = {
  all: ['forms'] as const,
  list: ['forms', 'list'] as const,
  submissions: (id: string) => ['forms', 'submissions', id] as const,
  contact: (contactId: string) => ['forms', 'contact', contactId] as const,
}

export function useForms() {
  return useQuery({ queryKey: formKeys.list, queryFn: formsApi.list })
}

export function useFormSubmissions(id: string) {
  return useQuery({ queryKey: formKeys.submissions(id), queryFn: () => formsApi.submissions(id) })
}

export function useContactSubmissions(contactId: string, enabled: boolean) {
  return useQuery({
    queryKey: formKeys.contact(contactId),
    queryFn: () => formsApi.byContact(contactId),
    enabled,
  })
}

export const FORM_KIND_LABEL: Record<FormKind, string> = {
  contact: 'Contato',
  service: 'Solicitação de serviço',
}

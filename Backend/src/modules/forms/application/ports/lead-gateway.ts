/**
 * O que forms precisa do contacts: registrar o lead do envio (sem duplicar
 * contato). Lança os erros de domínio do contato (telefone/e-mail inválido,
 * sem telefone nem e-mail). Adapter em infra/ sobre a ContactsFacade.
 */
export interface LeadGateway {
  capture(input: {
    name: string | null;
    phone: string | null;
    email: string | null;
    campaign: string;
  }): Promise<{ contactId: string }>;
}

export const LEAD_GATEWAY = Symbol('FormsLeadGateway');

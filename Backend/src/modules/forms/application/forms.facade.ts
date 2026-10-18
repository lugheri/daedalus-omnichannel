import { Inject, Injectable } from '@nestjs/common';
import type { FormKind } from '../domain/form.entity';
import { FORM_REPOSITORY, type FormRepository } from './ports/form.repository';

/** Formulário como o site o usa: para onde postar e o tipo (campos). */
export interface SiteFormSummary {
  /** Caminho do envio público na API (`/v1/public/forms/<chave>`); falta só a origem. */
  actionPath: string;
  kind: FormKind;
}

/** API do módulo forms para outros módulos (o site mostra um formulário). */
@Injectable()
export class FormsFacade {
  constructor(@Inject(FORM_REPOSITORY) private readonly forms: FormRepository) {}

  /** Quantos formulários a conta atual tem (o uso do plano). */
  async count(): Promise<number> {
    return (await this.forms.list()).length;
  }

  /** Formulário ATIVO da conta atual, ou null (pausado ou excluído: o site fica sem). */
  async siteForm(id: string): Promise<SiteFormSummary | null> {
    const form = await this.forms.findById(id);
    if (!form?.active) return null;
    return { actionPath: `/v1/public/forms/${form.publicKey}`, kind: form.kind };
  }
}

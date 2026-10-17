import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { InvalidFormError } from './errors/invalid-form.error';

export const FORM_KINDS = ['contact', 'service'] as const;
export type FormKind = (typeof FORM_KINDS)[number];

export interface FormSettings {
  name: string;
  /** Rótulo da origem do contato; null = o nome do formulário. */
  campaign: string | null;
  /** Página de obrigado do site; null = a página padrão da API. */
  successUrl: string | null;
}

export interface FormProps extends FormSettings {
  tenantId: string;
  kind: FormKind;
  /** Vai na URL do formulário publicado (sem chave de API na página). */
  publicKey: string;
  /** Inativo: recusa envios (o HTML publicado continua lá até ser tirado). */
  active: boolean;
  createdAt: Date;
}

/**
 * Formulário do site: de contato (nome, telefone/e-mail, mensagem) ou de
 * solicitação de serviço (+ serviço do catálogo e data preferida). O envio é
 * um `<form method="post">` direto para a API pela chave pública.
 */
export class Form extends AggregateRoot<FormProps> {
  static create(
    id: string,
    input: FormSettings & { tenantId: string; kind: string; publicKey: string },
  ): Form {
    if (!(FORM_KINDS as readonly string[]).includes(input.kind)) {
      throw new InvalidFormError('FORM_INVALID_KIND');
    }
    return new Form(id, {
      ...validSettings(input),
      tenantId: input.tenantId,
      kind: input.kind as FormKind,
      publicKey: input.publicKey,
      active: true,
      createdAt: new Date(),
    });
  }

  static restore(id: string, props: FormProps): Form {
    return new Form(id, props);
  }

  /** Campo ausente = não muda; `campaign`/`successUrl` null = tira. */
  update(changes: Partial<FormSettings> & { active?: boolean }): void {
    const { active, ...settings } = changes;
    const current = { name: this.name, campaign: this.campaign, successUrl: this.successUrl };
    const next = { ...current };
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) Object.assign(next, { [key]: value });
    }
    Object.assign(this.props, validSettings(next));
    if (active !== undefined) this.props.active = active;
  }

  /** Nova chave: a URL antiga para de funcionar (formulário vazado ou recebendo spam). */
  rotateKey(publicKey: string): void {
    this.props.publicKey = publicKey;
  }

  /** O rótulo que vai como origem (`sourceDetail`) do contato. */
  get sourceLabel(): string {
    return this.props.campaign ?? this.props.name;
  }

  get tenantId() {
    return this.props.tenantId;
  }
  get name() {
    return this.props.name;
  }
  get kind() {
    return this.props.kind;
  }
  get publicKey() {
    return this.props.publicKey;
  }
  get campaign() {
    return this.props.campaign;
  }
  get successUrl() {
    return this.props.successUrl;
  }
  get active() {
    return this.props.active;
  }
  get createdAt() {
    return this.props.createdAt;
  }
}

function validSettings(input: FormSettings): FormSettings {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 80) throw new InvalidFormError('FORM_INVALID_NAME');

  const campaign = input.campaign?.trim() || null;
  if (campaign && campaign.length > 80) throw new InvalidFormError('FORM_INVALID_CAMPAIGN');

  const successUrl = input.successUrl?.trim() || null;
  if (successUrl && !isWebUrl(successUrl)) throw new InvalidFormError('FORM_INVALID_SUCCESS_URL');

  return { name, campaign, successUrl };
}

/** http(s) absoluto e curto — vira um redirect, então nada de `javascript:`. */
function isWebUrl(value: string): boolean {
  if (value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

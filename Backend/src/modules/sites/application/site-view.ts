import type { SiteContent } from '../domain/site-content';
import type { SiteFormInfo, SiteProfessionalItem, SiteServiceItem } from './ports/site-sources';

/**
 * O que os marcadores do modelo enxergam ({{business.name}}, {{#services}}...).
 * É o contrato com quem escreve modelos: renomear ou tirar um campo quebra os
 * modelos existentes — só acrescente. A lista para o editor de modelos está no
 * front (`features/sites/markers.ts`) e precisa acompanhar esta.
 *
 * Todo item de lista tem todas as chaves (null quando vazio): no Mustache, uma
 * chave ausente é procurada no contexto de fora, e o modelo mostraria o valor
 * errado.
 */
export interface SiteViewInput {
  content: SiteContent;
  /** Endereço do site no ar (ou o que terá), para links absolutos e SEO. */
  siteUrl: string | null;
  /** URL pública de uma imagem do site; null se não existir mais. */
  assetUrl: (assetId: string) => string | null;
  services: SiteServiceItem[];
  professionals: SiteProfessionalItem[];
  form: SiteFormInfo | null;
  /** O site terá o widget do chat (o compositor injeta o script). */
  chatEnabled?: boolean;
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatPrice(cents: number | null): string {
  return cents === null ? 'Sob consulta' : money.format(cents / 100);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

function socialUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, '').replace(/^\/+/, '');
  return handle ? `${base}/${encodeURIComponent(handle)}` : null;
}

/** Cor do texto sobre a cor principal (preto ou branco, o que tiver mais contraste). */
function contrastOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? '#111111' : '#ffffff';
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formulário pronto (`{{{contactForm.html}}}`): `<form method="post">` puro
 * para a API, com o campo isca `website`. Sem estilo: o modelo estiliza pelas
 * classes `site-form*`. Mesmos campos do HTML da tela de formulários.
 */
export function contactFormHtml(
  form: SiteFormInfo,
  services: { id: string; name: string }[],
): string {
  const serviceFields =
    form.kind === 'service'
      ? `
  <label class="site-form-field">Serviço
    <select name="servico" required>
      <option value="">Escolha…</option>${services
        .map((s) => `\n      <option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`)
        .join('')}
    </select>
  </label>
  <label class="site-form-field">Quando você prefere?
    <input name="data_preferida" maxlength="100" placeholder="Ex.: sábado de manhã">
  </label>`
      : '';
  return `<form class="site-form" method="post" action="${escapeHtml(form.actionUrl)}">
  <label class="site-form-field">Nome
    <input name="nome" maxlength="120" autocomplete="name" required>
  </label>
  <label class="site-form-field">WhatsApp ou telefone
    <input name="telefone" type="tel" maxlength="40" autocomplete="tel" placeholder="(11) 99999-9999">
  </label>
  <label class="site-form-field">E-mail
    <input name="email" type="email" maxlength="320" autocomplete="email">
  </label>${serviceFields}
  <label class="site-form-field">Mensagem
    <textarea name="mensagem" rows="4" maxlength="2000"></textarea>
  </label>
  <input class="site-form-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
  <button class="site-form-submit" type="submit">${form.kind === 'service' ? 'Solicitar' : 'Enviar'}</button>
  <small class="site-form-note">Informe telefone ou e-mail para retornarmos.</small>
</form>`;
}

export function buildSiteView(input: SiteViewInput) {
  const { content } = input;
  const b = content.business;
  const on = content.sections;

  const whatsappDigits = b.whatsapp?.replace(/\D/g, '') ?? null;
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent('Olá! Vim pelo site.')}`
    : null;
  const phoneDigits = b.phone?.replace(/[^\d+]/g, '') ?? null;
  const mapsQuery = b.address ? encodeURIComponent(b.address) : null;

  const logoUrl = content.theme.logoAssetId ? input.assetUrl(content.theme.logoAssetId) : null;
  const heroUrl = content.theme.heroImageAssetId
    ? input.assetUrl(content.theme.heroImageAssetId)
    : null;

  const services = input.services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    price: formatPrice(s.priceCents),
    duration: formatDuration(s.durationMinutes),
  }));
  const professionals = input.professionals.map((p) => ({
    name: p.name,
    title: p.title,
    bio: p.bio,
    initials: initials(p.name),
  }));
  const gallery = content.gallery.flatMap((item) => {
    const url = input.assetUrl(item.assetId);
    return url ? [{ url, caption: item.caption }] : [];
  });
  const contactForm = input.form
    ? {
        action: input.form.actionUrl,
        isService: input.form.kind === 'service',
        services: services.map((s) => ({ id: s.id, name: s.name })),
        submitLabel: input.form.kind === 'service' ? 'Solicitar' : 'Enviar',
        html: contactFormHtml(input.form, services),
      }
    : null;

  const hasContactInfo = !!(b.phone || b.whatsapp || b.email || b.address || b.hours);
  const title = content.seo.title ?? (b.tagline ? `${b.name} — ${b.tagline}` : b.name);

  return {
    site: {
      url: input.siteUrl,
      title,
      description: content.seo.description ?? b.tagline ?? b.about?.slice(0, 160) ?? null,
      year: new Date().getFullYear(),
    },
    business: {
      name: b.name,
      tagline: b.tagline,
      about: b.about,
      phone: b.phone,
      phoneUrl: phoneDigits ? `tel:${phoneDigits}` : null,
      whatsapp: b.whatsapp,
      whatsappUrl,
      email: b.email,
      emailUrl: b.email ? `mailto:${b.email}` : null,
      address: b.address,
      hours: b.hours,
      hoursLines: b.hours ? b.hours.split(/\r?\n/).filter((line) => line.trim()) : [],
      instagramUrl: socialUrl(b.instagram, 'https://instagram.com'),
      facebookUrl: socialUrl(b.facebook, 'https://facebook.com'),
      mapsUrl: mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}` : null,
      mapsEmbedUrl: mapsQuery ? `https://www.google.com/maps?q=${mapsQuery}&output=embed` : null,
    },
    theme: {
      primaryColor: content.theme.primaryColor,
      primaryContrast: contrastOn(content.theme.primaryColor),
    },
    logo: logoUrl ? { url: logoUrl } : null,
    heroImage: heroUrl ? { url: heroUrl } : null,
    hero: {
      title: content.hero.title ?? b.name,
      subtitle: content.hero.subtitle ?? b.tagline,
      ctaLabel: content.hero.ctaLabel ?? (whatsappUrl ? 'Chamar no WhatsApp' : 'Fale conosco'),
      ctaUrl: whatsappUrl ?? '#contato',
    },
    // Ligada E com o que mostrar: o modelo não precisa conferir as duas coisas.
    sections: {
      about: on.about && !!b.about,
      services: on.services && services.length > 0,
      professionals: on.professionals && professionals.length > 0,
      gallery: on.gallery && gallery.length > 0,
      testimonials: on.testimonials && content.testimonials.length > 0,
      faq: on.faq && content.faq.length > 0,
      contact: on.contact && (hasContactInfo || !!contactForm),
      map: on.map && !!mapsQuery,
    },
    services,
    professionals,
    gallery,
    testimonials: content.testimonials.map((t) => ({ author: t.author, text: t.text })),
    faq: content.faq.map((f) => ({ question: f.question, answer: f.answer })),
    contactForm,
    // O botão do chat fica no canto inferior direito: o modelo pode subir o
    // seu botão de WhatsApp (`{{#chat.enabled}}`).
    chat: { enabled: input.chatEnabled === true },
  };
}

export type SiteView = ReturnType<typeof buildSiteView>;

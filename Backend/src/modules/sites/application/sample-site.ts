import { defaultSiteContent, type SiteContent } from '../domain/site-content';
import type { LandingViewInput } from './landing-view';
import type { SiteViewInput } from './site-view';

/** Imagem de exemplo sem depender de nada externo (a prévia roda num iframe isolado). */
function placeholder(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="${color}"/><text x="400" y="310" font-family="sans-serif" font-size="44" fill="#ffffff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const SAMPLE_IMAGES: Record<string, string> = {
  logo: placeholder('Logo', '#1f2937'),
  hero: placeholder('Foto de capa', '#475569'),
  g1: placeholder('Foto 1', '#64748b'),
  g2: placeholder('Foto 2', '#7c8aa0'),
  g3: placeholder('Foto 3', '#94a3b8'),
};

/**
 * Uma barbearia de mentira com tudo preenchido: é o que o editor de modelos
 * mostra na prévia, para que todas as seções apareçam.
 */
export function sampleSiteInput(): SiteViewInput {
  const base = defaultSiteContent('Barbearia do Zé');
  const content: SiteContent = {
    ...base,
    business: {
      ...base.business,
      tagline: 'Corte e barba no centro desde 2010',
      about:
        'Somos uma barbearia de bairro, com atendimento sem pressa e hora marcada. Café por nossa conta enquanto você espera.',
      phone: '(15) 3333-4444',
      whatsapp: '+5515999998888',
      email: 'contato@barbeariadoze.com.br',
      address: 'Rua das Flores, 123 - Centro, Sorocaba - SP',
      hours: 'Seg a sex: 9h às 19h\nSábado: 8h às 14h',
      instagram: '@barbeariadoze',
      facebook: null,
    },
    theme: { primaryColor: '#b45309', logoAssetId: 'logo', heroImageAssetId: 'hero' },
    gallery: [
      { assetId: 'g1', caption: 'Nosso espaço' },
      { assetId: 'g2', caption: 'Degradê' },
      { assetId: 'g3', caption: null },
    ],
    testimonials: [
      { author: 'Carlos M.', text: 'Melhor corte da cidade, e sempre no horário.' },
      { author: 'Rafael S.', text: 'Ambiente top e atendimento atencioso.' },
    ],
    faq: [
      {
        question: 'Precisa marcar horário?',
        answer: 'Recomendamos, mas atendemos por ordem de chegada também.',
      },
      { question: 'Quais formas de pagamento?', answer: 'Pix, cartão de débito e crédito.' },
    ],
  };
  return {
    content,
    siteUrl: 'https://barbearia-do-ze.exemplo.com.br',
    assetUrl: (id) => SAMPLE_IMAGES[id] ?? null,
    services: [
      {
        id: 's1',
        name: 'Corte',
        description: 'Tesoura ou máquina, com lavagem.',
        priceCents: 4500,
        durationMinutes: 40,
      },
      {
        id: 's2',
        name: 'Barba',
        description: 'Toalha quente e navalha.',
        priceCents: 3500,
        durationMinutes: 30,
      },
      { id: 's3', name: 'Corte + barba', description: null, priceCents: 7000, durationMinutes: 70 },
      { id: 's4', name: 'Pigmentação', description: null, priceCents: null, durationMinutes: 60 },
    ],
    professionals: [
      { name: 'José Almeida', title: 'Barbeiro e dono', bio: '20 anos de tesoura.' },
      { name: 'Lucas Pereira', title: 'Barbeiro', bio: null },
    ],
    form: { actionUrl: '#', kind: 'contact' },
    bookingEnabled: true,
  };
}

/**
 * Uma landing page de exemplo da mesma barbearia, com tudo preenchido: a
 * prévia do editor de modelos de landing.
 */
export function sampleLandingInput(): LandingViewInput {
  const site = sampleSiteInput();
  return {
    site: site.content,
    landing: {
      hero: {
        title: 'Dia dos Pais: corte + barba com 30% de desconto',
        subtitle: 'Só até domingo. Garanta o horário do seu pai (e o seu).',
        ctaLabel: 'Quero o desconto',
      },
      heroImageAssetId: null,
      intro:
        'Presente que ele vai usar: um trato completo, sem pressa, com toalha quente e café.\n\nVale para qualquer barbeiro da casa, de segunda a sábado.',
      benefits: [
        { title: 'Corte e barba completos', text: 'Lavagem, toalha quente e finalização.' },
        { title: 'Hora marcada', text: 'Sem fila: você escolhe o horário.' },
        { title: 'Pagamento fácil', text: 'Pix ou cartão, em até 3x.' },
      ],
      offer: {
        title: 'Corte + barba',
        price: 'R$ 49,00',
        oldPrice: 'R$ 70,00',
        note: 'Válido até domingo, 10/08.',
      },
      testimonials: site.content.testimonials,
      faq: [
        { question: 'Posso dar de presente?', answer: 'Pode: é só informar o nome dele.' },
        { question: 'Vale para qualquer dia?', answer: 'De segunda a sábado, com hora marcada.' },
      ],
      formTitle: 'Garanta o seu desconto',
      seo: { title: null, description: null },
    },
    pageUrl: 'https://barbearia-do-ze.exemplo.com.br/dia-dos-pais/',
    homeUrl: 'https://barbearia-do-ze.exemplo.com.br',
    assetUrl: site.assetUrl,
    services: site.services,
    form: { actionUrl: '#', kind: 'contact' },
    variant: 'a',
  };
}

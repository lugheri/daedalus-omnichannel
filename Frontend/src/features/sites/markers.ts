/**
 * Referência dos marcadores para quem escreve modelos. Espelho do "view" do
 * backend (`modules/sites/application/site-view.ts`): campo novo lá, entrada
 * nova aqui.
 */
export interface MarkerGroup {
  title: string
  items: { marker: string; description: string }[]
}

export const MARKER_GROUPS: MarkerGroup[] = [
  {
    title: 'Como usar',
    items: [
      { marker: '{{campo}}', description: 'Texto, com HTML escapado (seguro).' },
      {
        marker: '{{#campo}}…{{/campo}}',
        description: 'Mostra o bloco se existir; repete se for lista.',
      },
      { marker: '{{^campo}}…{{/campo}}', description: 'Mostra o bloco se NÃO existir.' },
      { marker: '{{{campo}}}', description: 'Sem escapar: só para o HTML pronto do formulário.' },
      { marker: '{{.}}', description: 'O próprio item, numa lista de textos (ex.: hoursLines).' },
    ],
  },
  {
    title: 'Site',
    items: [
      { marker: '{{site.title}}', description: 'Título (SEO) — ou nome e frase da empresa.' },
      { marker: '{{site.description}}', description: 'Descrição para o Google.' },
      { marker: '{{site.url}}', description: 'Endereço do site.' },
      { marker: '{{site.year}}', description: 'Ano atual (rodapé).' },
    ],
  },
  {
    title: 'Empresa',
    items: [
      { marker: '{{business.name}}', description: 'Nome.' },
      { marker: '{{business.tagline}}', description: 'Frase de apresentação.' },
      { marker: '{{business.about}}', description: 'Sobre (use white-space: pre-line).' },
      {
        marker: '{{business.phone}} / {{business.phoneUrl}}',
        description: 'Telefone e o link tel:.',
      },
      {
        marker: '{{business.whatsappUrl}}',
        description: 'Link do WhatsApp (wa.me, com mensagem).',
      },
      {
        marker: '{{business.email}} / {{business.emailUrl}}',
        description: 'E-mail e o link mailto:.',
      },
      { marker: '{{business.address}}', description: 'Endereço.' },
      { marker: '{{business.mapsUrl}}', description: 'Link do endereço no Google Maps.' },
      { marker: '{{business.mapsEmbedUrl}}', description: 'Mapa para <iframe>.' },
      {
        marker: '{{business.hours}} / {{#business.hoursLines}}',
        description: 'Horário (texto ou uma linha por item).',
      },
      {
        marker: '{{business.instagramUrl}} / {{business.facebookUrl}}',
        description: 'Redes sociais.',
      },
    ],
  },
  {
    title: 'Aparência e capa',
    items: [
      { marker: '{{theme.primaryColor}}', description: 'Cor principal (#rrggbb).' },
      { marker: '{{theme.primaryContrast}}', description: 'Cor do texto sobre a principal.' },
      { marker: '{{#logo}}{{url}}{{/logo}}', description: 'Logo, se houver.' },
      { marker: '{{#heroImage}}{{url}}{{/heroImage}}', description: 'Foto de capa, se houver.' },
      { marker: '{{hero.title}} / {{hero.subtitle}}', description: 'Textos da capa (com padrão).' },
      {
        marker: '{{hero.ctaLabel}} / {{hero.ctaUrl}}',
        description: 'Botão da capa (WhatsApp ou #contato).',
      },
    ],
  },
  {
    title: 'Seções (ligadas e com conteúdo)',
    items: [
      {
        marker: '{{#sections.about}}',
        description:
          'Também: services, professionals, gallery, testimonials, faq, contact, map, booking.',
      },
    ],
  },
  {
    title: 'Listas',
    items: [
      {
        marker: '{{#services}}',
        description: 'name, description, price ("R$ 45,00" ou "Sob consulta"), duration.',
      },
      { marker: '{{#professionals}}', description: 'name, title, bio, initials.' },
      { marker: '{{#gallery}}', description: 'url, caption.' },
      { marker: '{{#testimonials}}', description: 'author, text.' },
      { marker: '{{#faq}}', description: 'question, answer.' },
    ],
  },
  {
    title: 'Agendamento online',
    items: [
      {
        marker: '<div data-omni-booking></div>',
        description:
          'Onde o agendamento aparece (dentro de {{#sections.booking}}). Sem ele, entra uma seção antes do rodapé.',
      },
    ],
  },
  {
    title: 'Chat do site',
    items: [
      {
        marker: '{{#chat.enabled}}',
        description: 'O site tem o botão do chat (canto inferior direito): suba o seu botão.',
      },
    ],
  },
  {
    title: 'Formulário de contato',
    items: [
      {
        marker: '{{{contactForm.html}}}',
        description: 'Formulário pronto (classes site-form*), com anti-spam.',
      },
      {
        marker: '{{contactForm.action}}',
        description: 'Para montar o próprio <form method="post">.',
      },
      {
        marker: '{{#contactForm.isService}}',
        description: 'Formulário de serviço: campos servico e data_preferida.',
      },
    ],
  },
]

/**
 * Marcadores dos modelos de LANDING PAGE. Espelho de
 * `modules/sites/application/landing-view.ts` do backend.
 */
export const LANDING_MARKER_GROUPS: MarkerGroup[] = [
  MARKER_GROUPS[0],
  {
    title: 'Página',
    items: [
      { marker: '{{site.title}}', description: 'Título (SEO, ou o título da capa).' },
      { marker: '{{site.description}}', description: 'Descrição (SEO, ou o subtítulo).' },
      { marker: '{{site.url}}', description: 'Endereço da landing page (canônico).' },
      {
        marker: '{{#site.homeUrl}}',
        description: 'Endereço do site da conta (só com o site no ar): "voltar ao site".',
      },
      { marker: '{{landing.variant}}', description: 'Letra da variante (a, b, c, d).' },
    ],
  },
  {
    title: 'Empresa e aparência (do site da conta)',
    items: [
      {
        marker: '{{business.name}}, {{business.whatsappUrl}}…',
        description: 'Os mesmos campos da empresa do modelo de site.',
      },
      { marker: '{{theme.primaryColor}} / {{theme.primaryContrast}}', description: 'Cores.' },
      { marker: '{{#logo}}{{url}}{{/logo}}', description: 'Logo, se houver.' },
      {
        marker: '{{#heroImage}}{{url}}{{/heroImage}}',
        description: 'Imagem da capa da landing (ou a do site).',
      },
    ],
  },
  {
    title: 'Oferta',
    items: [
      { marker: '{{hero.title}} / {{hero.subtitle}}', description: 'Chamada da capa.' },
      {
        marker: '{{hero.ctaLabel}} / {{hero.ctaUrl}}',
        description: 'Botão: leva ao formulário (#formulario) ou ao WhatsApp, sem formulário.',
      },
      {
        marker: '{{#introParagraphs}}{{.}}{{/introParagraphs}}',
        description: 'Texto principal, um parágrafo por item (também {{intro}}).',
      },
      { marker: '{{#benefits}}', description: 'title, text.' },
      { marker: '{{#offer}}', description: 'title, price, oldPrice, note.' },
      { marker: '{{#testimonials}} / {{#faq}}', description: 'Como no site.' },
    ],
  },
  {
    title: 'Seções (com conteúdo)',
    items: [
      {
        marker: '{{#sections.intro}}',
        description: 'Também: benefits, offer, testimonials, faq, form.',
      },
    ],
  },
  {
    title: 'Formulário',
    items: [
      {
        marker: '{{{contactForm.html}}}',
        description: 'Formulário pronto; o envio conta como conversão da variante.',
      },
      { marker: '{{contactForm.title}}', description: 'Título da seção do formulário.' },
      {
        marker: '{{contactForm.action}}',
        description: 'Para montar o próprio <form method="post"> (já marca a variante).',
      },
      { marker: 'id="formulario"', description: 'Onde o botão da capa leva: use no formulário.' },
    ],
  },
]

export function markerGroupsFor(kind: 'site' | 'landing'): MarkerGroup[] {
  return kind === 'landing' ? LANDING_MARKER_GROUPS : MARKER_GROUPS
}

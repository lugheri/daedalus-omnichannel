/**
 * Modelo inicial: o HTML com que todo modelo novo nasce. Página única,
 * responsiva, sem JavaScript, usando todos os marcadores — serve de ponto de
 * partida e de exemplo de como cada seção é montada.
 */
export const STARTER_TEMPLATE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{site.title}}</title>
{{#site.description}}<meta name="description" content="{{site.description}}">{{/site.description}}
{{#site.url}}<link rel="canonical" href="{{site.url}}">{{/site.url}}
<meta property="og:title" content="{{site.title}}">
{{#heroImage}}<meta property="og:image" content="{{url}}">{{/heroImage}}
<style>
  :root {
    --primary: {{theme.primaryColor}};
    --on-primary: {{theme.primaryContrast}};
    --text: #1f2328;
    --muted: #5b6472;
    --soft: #f5f6f8;
    --line: #e6e8ec;
    --radius: 14px;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--text); background: #fff; }
  img { max-width: 100%; display: block; }
  a { color: var(--primary); }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 0 20px; }

  .top { position: sticky; top: 0; z-index: 10; background: rgba(255, 255, 255, .95); border-bottom: 1px solid var(--line); }
  .top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 64px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.1rem; color: var(--text); text-decoration: none; }
  .brand img { height: 40px; width: auto; border-radius: 8px; }
  .menu { display: flex; gap: 18px; flex-wrap: wrap; }
  .menu a { color: var(--muted); text-decoration: none; font-size: .95rem; }
  .menu a:hover { color: var(--primary); }

  .btn, .site-form-submit { display: inline-block; background: var(--primary); color: var(--on-primary); padding: 14px 26px; border: 0; border-radius: 999px; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }

  .hero { position: relative; color: #fff; background: #222 center / cover no-repeat; }
  .hero::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, .35), rgba(0, 0, 0, .65)); }
  .hero .wrap { position: relative; padding: 110px 20px 100px; }
  .hero h1 { font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.15; margin: 0 0 12px; max-width: 18ch; }
  .hero p { font-size: 1.2rem; margin: 0 0 28px; max-width: 42ch; opacity: .92; }
  .hero.plain { background: var(--primary); color: var(--on-primary); }
  .hero.plain::before { display: none; }
  .hero.plain .btn { background: var(--on-primary); color: var(--primary); }

  section { padding: 72px 0; }
  .alt { background: var(--soft); }
  h2 { font-size: clamp(1.6rem, 3.5vw, 2.2rem); line-height: 1.2; margin: 0 0 28px; }
  .lead { font-size: 1.1rem; max-width: 70ch; white-space: pre-line; margin: 0; }

  .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .card { background: #fff; border: 1px solid var(--line); border-radius: var(--radius); padding: 22px; }
  .card h3 { margin: 0 0 6px; font-size: 1.1rem; }
  .card p { margin: 0; color: var(--muted); }
  .price { display: flex; justify-content: space-between; align-items: baseline; margin-top: 14px; font-weight: 700; color: var(--primary); }
  .price small { color: var(--muted); font-weight: 400; }
  .avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--primary); color: var(--on-primary); display: grid; place-items: center; font-weight: 700; font-size: 1.3rem; margin-bottom: 12px; }

  .gallery { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  .gallery figure { margin: 0; }
  .gallery img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--radius); }
  .gallery figcaption { font-size: .9rem; color: var(--muted); margin-top: 6px; }

  blockquote { margin: 0; }
  blockquote p { font-size: 1.05rem; color: var(--text); margin: 0 0 12px; }
  blockquote cite { font-style: normal; font-weight: 600; color: var(--muted); }

  details { background: #fff; border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 10px; }
  summary { font-weight: 600; cursor: pointer; }
  details p { margin: 10px 0 0; color: var(--muted); white-space: pre-line; }

  .contact { display: grid; gap: 32px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .info { list-style: none; padding: 0; margin: 0; display: grid; gap: 16px; }
  .info strong { display: block; font-size: .8rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .info span { display: block; }
  .site-form { display: grid; gap: 12px; }
  .site-form-field { display: grid; gap: 4px; font-weight: 600; font-size: .95rem; }
  .site-form input, .site-form select, .site-form textarea { font: inherit; font-weight: 400; padding: 12px; border: 1px solid #cfd4dc; border-radius: 10px; background: #fff; }
  .site-form-note { color: var(--muted); }

  .map { padding: 0; }
  .map iframe { display: block; width: 100%; height: 380px; border: 0; }

  footer { background: #14171c; color: #c9ced6; padding: 36px 0; font-size: .95rem; }
  footer .wrap { display: flex; flex-wrap: wrap; gap: 16px; justify-content: space-between; }
  footer a { color: #fff; margin-left: 14px; }

  .wa-float { position: fixed; right: 18px; bottom: 18px; z-index: 20; width: 58px; height: 58px; border-radius: 50%; background: #25d366; display: grid; place-items: center; box-shadow: 0 6px 20px rgba(0, 0, 0, .25); }
  .wa-float svg { width: 30px; height: 30px; fill: #fff; }
  /* Com o chat do site, o botão dele fica no canto: o do WhatsApp sobe. */
  .wa-float.with-chat { bottom: 92px; }

  @media (max-width: 720px) {
    .menu { display: none; }
    .hero .wrap { padding: 80px 20px 70px; }
    section { padding: 56px 0; }
  }
</style>
</head>
<body>
<header class="top">
  <div class="wrap">
    <a class="brand" href="#inicio">{{#logo}}<img src="{{url}}" alt="">{{/logo}}<span>{{business.name}}</span></a>
    <nav class="menu" aria-label="Seções do site">
      {{#sections.about}}<a href="#sobre">Sobre</a>{{/sections.about}}
      {{#sections.services}}<a href="#servicos">Serviços</a>{{/sections.services}}
      {{#sections.professionals}}<a href="#equipe">Equipe</a>{{/sections.professionals}}
      {{#sections.gallery}}<a href="#fotos">Fotos</a>{{/sections.gallery}}
      {{#sections.faq}}<a href="#duvidas">Dúvidas</a>{{/sections.faq}}
      {{#sections.booking}}<a href="#agendar">Agendar</a>{{/sections.booking}}
      {{#sections.contact}}<a href="#contato">Contato</a>{{/sections.contact}}
    </nav>
  </div>
</header>

<main id="inicio">
  {{#heroImage}}<section class="hero" style="background-image: url('{{url}}')">{{/heroImage}}
  {{^heroImage}}<section class="hero plain">{{/heroImage}}
    <div class="wrap">
      <h1>{{hero.title}}</h1>
      {{#hero.subtitle}}<p>{{hero.subtitle}}</p>{{/hero.subtitle}}
      <a class="btn" href="{{hero.ctaUrl}}">{{hero.ctaLabel}}</a>
    </div>
  </section>

  {{#sections.about}}
  <section id="sobre">
    <div class="wrap">
      <h2>Sobre nós</h2>
      <p class="lead">{{business.about}}</p>
    </div>
  </section>
  {{/sections.about}}

  {{#sections.services}}
  <section id="servicos" class="alt">
    <div class="wrap">
      <h2>Serviços</h2>
      <div class="grid">
        {{#services}}
        <article class="card">
          <h3>{{name}}</h3>
          {{#description}}<p>{{description}}</p>{{/description}}
          <div class="price"><span>{{price}}</span><small>{{duration}}</small></div>
        </article>
        {{/services}}
      </div>
    </div>
  </section>
  {{/sections.services}}

  {{#sections.professionals}}
  <section id="equipe">
    <div class="wrap">
      <h2>Nossa equipe</h2>
      <div class="grid">
        {{#professionals}}
        <article class="card">
          <div class="avatar" aria-hidden="true">{{initials}}</div>
          <h3>{{name}}</h3>
          {{#title}}<p><strong>{{title}}</strong></p>{{/title}}
          {{#bio}}<p>{{bio}}</p>{{/bio}}
        </article>
        {{/professionals}}
      </div>
    </div>
  </section>
  {{/sections.professionals}}

  {{#sections.gallery}}
  <section id="fotos" class="alt">
    <div class="wrap">
      <h2>Fotos</h2>
      <div class="gallery">
        {{#gallery}}
        <figure>
          <img src="{{url}}" alt="{{caption}}" loading="lazy">
          {{#caption}}<figcaption>{{caption}}</figcaption>{{/caption}}
        </figure>
        {{/gallery}}
      </div>
    </div>
  </section>
  {{/sections.gallery}}

  {{#sections.testimonials}}
  <section id="depoimentos">
    <div class="wrap">
      <h2>O que dizem os clientes</h2>
      <div class="grid">
        {{#testimonials}}
        <blockquote class="card">
          <p>“{{text}}”</p>
          <cite>{{author}}</cite>
        </blockquote>
        {{/testimonials}}
      </div>
    </div>
  </section>
  {{/sections.testimonials}}

  {{#sections.faq}}
  <section id="duvidas" class="alt">
    <div class="wrap">
      <h2>Dúvidas frequentes</h2>
      {{#faq}}
      <details>
        <summary>{{question}}</summary>
        <p>{{answer}}</p>
      </details>
      {{/faq}}
    </div>
  </section>
  {{/sections.faq}}

  {{#sections.booking}}
  <section id="agendar" class="alt">
    <div class="wrap">
      <h2>Agende seu horário</h2>
      <div data-omni-booking><p class="lead">Carregando os horários disponíveis…</p></div>
    </div>
  </section>
  {{/sections.booking}}

  {{#sections.contact}}
  <section id="contato">
    <div class="wrap">
      <h2>Fale com a gente</h2>
      <div class="contact">
        <ul class="info">
          {{#business.whatsappUrl}}<li><strong>WhatsApp</strong><a href="{{business.whatsappUrl}}">Chamar no WhatsApp</a></li>{{/business.whatsappUrl}}
          {{#business.phone}}<li><strong>Telefone</strong><a href="{{business.phoneUrl}}">{{business.phone}}</a></li>{{/business.phone}}
          {{#business.email}}<li><strong>E-mail</strong><a href="{{business.emailUrl}}">{{business.email}}</a></li>{{/business.email}}
          {{#business.address}}<li><strong>Endereço</strong>{{#business.mapsUrl}}<a href="{{business.mapsUrl}}">{{business.address}}</a>{{/business.mapsUrl}}</li>{{/business.address}}
          {{#business.hours}}<li><strong>Horário</strong>{{#business.hoursLines}}<span>{{.}}</span>{{/business.hoursLines}}</li>{{/business.hours}}
        </ul>
        {{#contactForm}}<div>{{{contactForm.html}}}</div>{{/contactForm}}
      </div>
    </div>
  </section>
  {{/sections.contact}}

  {{#sections.map}}
  <section class="map" aria-label="Mapa">
    <iframe src="{{business.mapsEmbedUrl}}" title="Mapa: {{business.address}}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
  </section>
  {{/sections.map}}
</main>

<footer>
  <div class="wrap">
    <span>© {{site.year}} {{business.name}}</span>
    <span>
      {{#business.instagramUrl}}<a href="{{business.instagramUrl}}">Instagram</a>{{/business.instagramUrl}}
      {{#business.facebookUrl}}<a href="{{business.facebookUrl}}">Facebook</a>{{/business.facebookUrl}}
    </span>
  </div>
</footer>

{{#business.whatsappUrl}}
<a class="wa-float{{#chat.enabled}} with-chat{{/chat.enabled}}" href="{{business.whatsappUrl}}" aria-label="Conversar no WhatsApp">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.03 2 11c0 2.4 1.05 4.58 2.77 6.19L4 22l4.94-1.9c.97.27 1.99.4 3.06.4 5.52 0 10-4.03 10-9S17.52 2 12 2z"/></svg>
</a>
{{/business.whatsappUrl}}
</body>
</html>
`;

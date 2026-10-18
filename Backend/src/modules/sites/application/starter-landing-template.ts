/**
 * Modelo inicial de LANDING (ADR 0014): o HTML com que todo modelo de landing
 * nasce. Uma página de conversão: capa com a chamada, texto, benefícios,
 * oferta, depoimentos, dúvidas e o formulário — tudo levando ao formulário.
 * Sem JavaScript; usa todos os marcadores do view da landing.
 */
export const STARTER_LANDING_TEMPLATE_HTML = `<!doctype html>
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
    --radius: 16px;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--text); background: #fff; }
  img { max-width: 100%; display: block; }
  a { color: var(--primary); }
  .wrap { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
  .narrow { max-width: 760px; }

  .top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 64px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--text); text-decoration: none; }
  .brand img { height: 40px; width: auto; border-radius: 8px; }

  .btn, .site-form-submit { display: inline-block; background: var(--primary); color: var(--on-primary); padding: 15px 30px; border: 0; border-radius: 999px; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; box-shadow: 0 6px 18px rgba(0, 0, 0, .15); }

  .hero { position: relative; color: #fff; background: #222 center / cover no-repeat; }
  .hero::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0, 0, 0, .45), rgba(0, 0, 0, .7)); }
  .hero .wrap { position: relative; padding: 96px 20px 88px; text-align: center; }
  .hero h1 { font-size: clamp(2rem, 5.5vw, 3.4rem); line-height: 1.1; margin: 0 auto 14px; max-width: 20ch; }
  .hero p { font-size: 1.25rem; margin: 0 auto 30px; max-width: 46ch; opacity: .94; }
  .hero.plain { background: var(--primary); color: var(--on-primary); }
  .hero.plain::before { display: none; }
  .hero.plain .btn { background: var(--on-primary); color: var(--primary); }

  section { padding: 64px 0; }
  .alt { background: var(--soft); }
  h2 { font-size: clamp(1.5rem, 3.5vw, 2.1rem); line-height: 1.2; margin: 0 0 24px; text-align: center; }
  .intro p { font-size: 1.15rem; margin: 0 0 16px; }

  .benefits { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .benefit { background: #fff; border: 1px solid var(--line); border-radius: var(--radius); padding: 22px; }
  .benefit h3 { margin: 0 0 6px; font-size: 1.1rem; display: flex; gap: 10px; align-items: baseline; }
  .benefit h3::before { content: "✓"; color: var(--primary); font-weight: 800; }
  .benefit p { margin: 0; color: var(--muted); }

  .offer { max-width: 560px; margin: 0 auto; text-align: center; background: #fff; border: 2px solid var(--primary); border-radius: var(--radius); padding: 34px 26px; }
  .offer h2 { margin-bottom: 12px; }
  .old { color: var(--muted); text-decoration: line-through; font-size: 1.1rem; }
  .price { font-size: clamp(2.2rem, 6vw, 3rem); font-weight: 800; color: var(--primary); line-height: 1.1; margin: 4px 0 10px; }
  .note { color: var(--muted); margin: 0 0 22px; }

  .quotes { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .quote { margin: 0; background: #fff; border: 1px solid var(--line); border-radius: var(--radius); padding: 22px; }
  .quote p { margin: 0 0 10px; font-style: italic; }
  .quote cite { color: var(--muted); font-style: normal; font-weight: 600; }

  details { border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px; margin: 0 0 10px; background: #fff; }
  summary { cursor: pointer; font-weight: 600; }
  details p { margin: 10px 0 0; color: var(--muted); }

  .form-box { max-width: 560px; margin: 0 auto; background: #fff; border-radius: var(--radius); padding: 30px 24px; box-shadow: 0 10px 40px rgba(0, 0, 0, .08); }
  .site-form { display: grid; gap: 14px; }
  .site-form-field { display: grid; gap: 6px; font-weight: 600; font-size: .95rem; }
  .site-form-field input, .site-form-field select, .site-form-field textarea { font: inherit; font-weight: 400; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; }
  .site-form-submit { width: 100%; }
  .site-form-note { color: var(--muted); text-align: center; }

  footer { padding: 32px 0; color: var(--muted); font-size: .95rem; text-align: center; }
  footer p { margin: 4px 0; }
</style>
</head>
<body>
  <header class="top">
    <div class="wrap">
      {{#site.homeUrl}}<a class="brand" href="{{site.homeUrl}}">{{/site.homeUrl}}
      {{^site.homeUrl}}<span class="brand">{{/site.homeUrl}}
        {{#logo}}<img src="{{url}}" alt="">{{/logo}}
        {{^logo}}{{business.name}}{{/logo}}
      {{#site.homeUrl}}</a>{{/site.homeUrl}}
      {{^site.homeUrl}}</span>{{/site.homeUrl}}
      {{#business.whatsappUrl}}<a href="{{business.whatsappUrl}}">WhatsApp</a>{{/business.whatsappUrl}}
    </div>
  </header>

  <section class="hero{{^heroImage}} plain{{/heroImage}}"{{#heroImage}} style="background-image: url('{{url}}')"{{/heroImage}}>
    <div class="wrap">
      <h1>{{hero.title}}</h1>
      {{#hero.subtitle}}<p>{{hero.subtitle}}</p>{{/hero.subtitle}}
      <a class="btn" href="{{hero.ctaUrl}}">{{hero.ctaLabel}}</a>
    </div>
  </section>

  {{#sections.intro}}
  <section class="intro">
    <div class="wrap narrow">
      {{#introParagraphs}}<p>{{.}}</p>{{/introParagraphs}}
    </div>
  </section>
  {{/sections.intro}}

  {{#sections.benefits}}
  <section class="alt">
    <div class="wrap">
      <h2>O que você ganha</h2>
      <div class="benefits">
        {{#benefits}}
        <div class="benefit">
          <h3>{{title}}</h3>
          {{#text}}<p>{{text}}</p>{{/text}}
        </div>
        {{/benefits}}
      </div>
    </div>
  </section>
  {{/sections.benefits}}

  {{#sections.offer}}
  <section>
    <div class="wrap">
      {{#offer}}
      <div class="offer">
        {{#title}}<h2>{{title}}</h2>{{/title}}
        {{#oldPrice}}<div class="old">{{oldPrice}}</div>{{/oldPrice}}
        {{#price}}<div class="price">{{price}}</div>{{/price}}
        {{#note}}<p class="note">{{note}}</p>{{/note}}
        <a class="btn" href="{{hero.ctaUrl}}">{{hero.ctaLabel}}</a>
      </div>
      {{/offer}}
    </div>
  </section>
  {{/sections.offer}}

  {{#sections.testimonials}}
  <section class="alt">
    <div class="wrap">
      <h2>Quem já aproveitou</h2>
      <div class="quotes">
        {{#testimonials}}
        <blockquote class="quote">
          <p>“{{text}}”</p>
          <cite>{{author}}</cite>
        </blockquote>
        {{/testimonials}}
      </div>
    </div>
  </section>
  {{/sections.testimonials}}

  {{#sections.faq}}
  <section>
    <div class="wrap narrow">
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

  {{#sections.form}}
  <section id="formulario" class="alt">
    <div class="wrap">
      {{#contactForm}}
      <h2>{{title}}</h2>
      <div class="form-box">{{{html}}}</div>
      {{/contactForm}}
    </div>
  </section>
  {{/sections.form}}

  <footer>
    <div class="wrap">
      <p><strong>{{business.name}}</strong></p>
      {{#business.address}}<p>{{business.address}}</p>{{/business.address}}
      {{#business.phone}}<p><a href="{{business.phoneUrl}}">{{business.phone}}</a></p>{{/business.phone}}
      {{#site.homeUrl}}<p><a href="{{site.homeUrl}}">Conheça o nosso site</a></p>{{/site.homeUrl}}
      <p>© {{site.year}} {{business.name}}</p>
    </div>
  </footer>
</body>
</html>
`;

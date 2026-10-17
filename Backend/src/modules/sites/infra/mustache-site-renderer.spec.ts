import { sampleSiteInput } from '../application/sample-site';
import { buildSiteView } from '../application/site-view';
import { STARTER_TEMPLATE_HTML } from '../application/starter-template';
import { InvalidSiteError } from '../domain/errors/invalid-site.error';
import { MustacheSiteRenderer } from './mustache-site-renderer';

describe('MustacheSiteRenderer', () => {
  const renderer = new MustacheSiteRenderer();

  it('renders the starter template with every section of the sample site', () => {
    const html = renderer.render(STARTER_TEMPLATE_HTML, buildSiteView(sampleSiteInput()));
    expect(html).toContain('<title>Barbearia do Zé — Corte e barba no centro desde 2010</title>');
    expect(html).toContain('--primary: #b45309;');
    for (const id of [
      'sobre',
      'servicos',
      'equipe',
      'fotos',
      'depoimentos',
      'duvidas',
      'contato',
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    // O Intl separa a moeda com espaço não separável (U+00A0).
    expect(html).toContain('R$\u00a045,00');
    expect(html).toContain('<span>Sábado: 8h às 14h</span>');
    expect(html).toContain('class="site-form"');
    // URLs legíveis (sem `&#x2F;`), e o `&` da query escapado como deve.
    expect(html).toContain(
      'href="https://wa.me/5515999998888?text=Ol%C3%A1!%20Vim%20pelo%20site."',
    );
    expect(html).toContain('src="https://www.google.com/maps?q=Rua%20das');
    expect(html).toContain('&amp;output=embed"');
    expect(html).not.toContain('{{');
  });

  it('escapes what the account typed and drops sections turned off', () => {
    const input = sampleSiteInput();
    input.content.business.name = '<script>alert(1)</script>';
    input.content.sections.faq = false;
    input.content.sections.gallery = false;
    const html = renderer.render(STARTER_TEMPLATE_HTML, buildSiteView(input));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('id="duvidas"');
    expect(html).not.toContain('id="fotos"');
  });

  it('reports why a template cannot be read', () => {
    expect(renderer.check('<p>{{#services}}x</p>')).toMatch(/Unclosed section "services"/);
    expect(renderer.check(STARTER_TEMPLATE_HTML)).toBeNull();
    expect(() => renderer.render('{{#a}}', {})).toThrow(InvalidSiteError);
  });
});

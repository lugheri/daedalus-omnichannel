import { apexOf, domainVariants, validCustomDomain } from './site-domain';

describe('custom domain', () => {
  it('accepts what people paste and normalizes it', () => {
    expect(validCustomDomain('https://WWW.Barbearia.com.br/contato?x=1', null)).toBe(
      'www.barbearia.com.br',
    );
    expect(validCustomDomain('barbearia.com:443', null)).toBe('barbearia.com');
    expect(validCustomDomain('www.açaí.com.br', null)).toBe('www.xn--aa-4iaz.com.br');
  });

  it('refuses names that are not public domains, and our own', () => {
    for (const raw of ['', 'barbearia', '10.0.0.1', 'bar_bearia.com', '-a.com', 'a..com']) {
      expect(() => validCustomDomain(raw, null)).toThrow(
        expect.objectContaining({ code: 'SITE_INVALID_DOMAIN' }) as Error,
      );
    }
    expect(validCustomDomain('www.barbearia.localhost', 'localhost')).toBe(
      'www.barbearia.localhost',
    );
    expect(() => validCustomDomain('loja.meusites.com.br', 'meusites.com.br')).toThrow(
      expect.objectContaining({ code: 'SITE_DOMAIN_IS_OURS' }) as Error,
    );
  });

  it('www domains redirect from the bare domain; both forms are reserved', () => {
    expect(apexOf('www.barbearia.com.br')).toBe('barbearia.com.br');
    expect(apexOf('loja.barbearia.com.br')).toBeNull();
    expect(domainVariants('www.a.com')).toEqual(['www.a.com', 'a.com']);
    expect(domainVariants('a.com')).toEqual(['a.com', 'www.a.com']);
  });
});

const MAX_LENGTH = 50;

/**
 * Identificador legível e único do tenant, para URLs (ex.: `padaria-do-ze`).
 * Gerado a partir do nome; se já existir, recebe um sufixo.
 */
export class Slug {
  private constructor(readonly value: string) {}

  static fromName(name: string): Slug {
    const base = name
      .normalize('NFD')
      .replace(/\p{M}/gu, '') // remove acentos: "Padaria do Zé" → "Padaria do Ze"
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_LENGTH)
      .replace(/-+$/g, '');

    return new Slug(base || 'account');
  }

  static restore(value: string): Slug {
    return new Slug(value);
  }

  withSuffix(suffix: string): Slug {
    const room = MAX_LENGTH - suffix.length - 1;
    return new Slug(`${this.value.slice(0, room).replace(/-+$/g, '')}-${suffix}`);
  }
}

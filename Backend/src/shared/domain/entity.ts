/**
 * Entidade: definida pela identidade, não pelos valores.
 * O construtor é protegido — entidades nascem por métodos estáticos
 * (`create` para novas, `restore` para as carregadas da persistência).
 */
export abstract class Entity<Props extends object> {
  protected constructor(
    readonly id: string,
    protected props: Props,
  ) {}

  equals(other: Entity<Props>): boolean {
    return this.id === other.id;
  }
}

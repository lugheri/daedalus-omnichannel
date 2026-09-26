/**
 * Erro de regra de negócio. O `code` é estável e é o que o frontend usa para
 * exibir a mensagem traduzida — nunca dependa do texto de `message`.
 *
 * Um exception filter global converte para HTTP:
 * - UnauthorizedError → 401
 * - NotFoundError → 404
 * - ConflictError → 409
 * - demais DomainError → 422
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export abstract class UnauthorizedError extends DomainError {}

export abstract class NotFoundError extends DomainError {}

export abstract class ConflictError extends DomainError {}

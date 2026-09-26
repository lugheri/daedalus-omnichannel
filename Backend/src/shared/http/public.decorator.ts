import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'auth:is-public';

/**
 * Libera a rota do guard de autenticação global. Toda rota é protegida por
 * padrão (ADR 0004): esquecer o decorator fecha a rota, nunca a abre.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);

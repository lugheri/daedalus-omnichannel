/**
 * A conta pode receber tráfego público? Usado pelas rotas abertas que
 * descobrem a conta por uma chave pública (formulário, agendamento, chat do
 * site, visitas das landing pages): conta suspensa não recebe mais nada,
 * do mesmo jeito que a chave de API dela para de valer (ADR 0009).
 *
 * Por que um port no shared, e não uma chamada à `AccountsFacade`: essas
 * rotas rodam SEM tenant resolvido no momento da conferência (a chave é que
 * diz a conta), e a facade só fala da conta atual.
 */
export interface AccountStanding {
  /** `false` para conta suspensa ou inexistente. */
  acceptsPublicTraffic(tenantId: string): Promise<boolean>;
}

export const ACCOUNT_STANDING = Symbol('AccountStanding');

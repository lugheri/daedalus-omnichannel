/** Para onde a página publicada avisa a visita (rota pública da API). */
export interface LandingBeacon {
  viewUrl(variantId: string): string;
}

export const LANDING_BEACON = Symbol('LandingBeacon');

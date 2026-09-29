import { ProviderRejectedError } from '../domain/errors/provider-rejected.error';
import { ProviderUnavailableError } from '../domain/errors/provider-unavailable.error';

const TIMEOUT_MS = 10_000;

/**
 * Chamada HTTP a um provedor, com tempo limite. Classifica a falha:
 * - 4xx (menos 429): o provedor recusou (credencial, remetente, destino) →
 *   ProviderRejectedError — não adianta repetir;
 * - 429, 5xx, rede, tempo esgotado → ProviderUnavailableError — vale repetir.
 */
export async function callProvider(
  url: string,
  init: RequestInit,
  describeError: (status: number, body: unknown) => string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    throw new ProviderUnavailableError(timedOut ? 'tempo esgotado' : 'provedor inalcançável');
  }
  if (response.ok) return response;

  const body: unknown = await response.json().catch(() => null);
  const reason = `${describeError(response.status, body)} (HTTP ${response.status})`;
  if (response.status === 429 || response.status >= 500) throw new ProviderUnavailableError(reason);
  throw new ProviderRejectedError(reason);
}

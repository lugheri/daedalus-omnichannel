import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';

const HEADER = 'x-request-id';
/** Aceita o id de quem chamou (ex.: Traefik) só se tiver um formato razoável. */
const VALID = /^[\w.:|-]{8,128}$/;

/** Requisição HTTP/1 ou HTTP/2: só os headers importam aqui. */
export interface WithHeaders {
  headers: NodeJS.Dict<string | string[]>;
}

/**
 * O correlation id da requisição HTTP: o `X-Request-Id` recebido (se válido)
 * ou um novo. Quem chama primeiro (o Fastify, no `genReqId`) grava o id no
 * header da requisição; os seguintes (CLS, logger) o reaproveitam — todos
 * chegam ao mesmo valor, em qualquer ordem.
 */
export function requestIdFor(req: WithHeaders, res?: ServerResponse): string {
  const incoming = req.headers[HEADER];
  const id = typeof incoming === 'string' && VALID.test(incoming) ? incoming : randomUUID();
  req.headers[HEADER] = id;
  if (res && !res.headersSent) res.setHeader(HEADER, id);
  return id;
}

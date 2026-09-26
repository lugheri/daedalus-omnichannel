# 0005 — Refresh token em cookie HttpOnly e frontend SPA

- **Status:** Aceito
- **Data:** 2026-09-26
- **Complementa:** [0004](0004-autenticacao.md)

## Contexto

O ADR 0004 definiu access token curto (JWT) e refresh token opaco e rotativo, sem definir como o refresh token chega ao cliente. O frontend será uma SPA em **React + Vite**, servida como arquivos estáticos. Guardar o refresh token em `localStorage` o deixaria ao alcance de qualquer script da página: um XSS roubaria a sessão por até 30 dias.

## Decisão

- O **refresh token** vai num cookie `refresh_token` com `HttpOnly`, `SameSite=Strict`, `Secure` (fora de dev) e `Path=/v1/auth` — o JavaScript do front não consegue lê-lo, e ele só trafega nas rotas de sessão.
- O **access token** vai no corpo da resposta e o front o mantém **só em memória**; ao recarregar a página, o front chama `POST /v1/auth/refresh` para obter um novo.
- **CSRF**: as rotas autenticadas por cookie (`signup`, `login`, `refresh`, `logout`) verificam o header `Origin` contra a lista `CORS_ORIGINS` (`TrustedOriginGuard`), além do `SameSite=Strict`.
- **CORS** restrito às origens de `CORS_ORIGINS`, com `credentials: true`.

## Alternativas consideradas

- **Refresh token no corpo** (front guarda em `localStorage`) — mais simples e igual para web e mobile, mas exposto a XSS.
- **Os dois modos** — flexível, mas dobra a superfície a testar; pode ser adicionado quando houver app mobile ou integração que precise.
- **Next.js com BFF** (o servidor do front guarda os tokens) — resolve o mesmo problema, mas adiciona um servidor Node a operar; desnecessário para um painel de atendimento.

## Consequências

- **Front e API precisam estar no mesmo site** (mesmo domínio registrável): ex. `app.dominio.com` e `api.dominio.com`. Em domínios diferentes o navegador não envia o cookie `SameSite=Strict`. Em dev, `localhost:5173` e `localhost:3000` funcionam.
- O front precisa usar `credentials: 'include'` nas chamadas a `/v1/auth/*`.
- Um cliente não-navegador (app mobile, integração) precisará de outro modo de entrega — a ser decidido em ADR próprio quando surgir.

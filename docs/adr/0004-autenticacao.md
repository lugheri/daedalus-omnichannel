# 0004 — Autenticação própria com JWT e refresh token rotativo

- **Status:** Aceito
- **Data:** 2026-09-26

## Contexto

A plataforma precisa autenticar usuários (e-mail e senha no MVP) e emitir credenciais válidas para um tenant específico (ver ADR 0002 e 0003). Clientes corporativos podem, no futuro, exigir SSO (SAML/OIDC).

## Decisão

- **Autenticação própria** no módulo `identity`, atrás de um port, para que um provedor externo possa ser plugado como adapter se SSO for exigido.
- Senhas com **Argon2id** (`@node-rs/argon2`, binários pré-compilados).
- **Access token JWT de 15 minutos**, contendo apenas `sub` (userId), `tid` (tenantId) e `mid` (membershipId).
- **Refresh token opaco**, armazenado apenas como hash, com **rotação a cada uso**; reutilização de um refresh token já trocado revoga toda a sessão.
- **Permissões não vão no token**: são resolvidas por requisição a partir de cache no Redis, invalidado quando o cargo ou o membership muda — revogar acesso tem efeito imediato.
- Um token vale para **um tenant**; trocar de conta emite novo token.
- **Guard global**: todo endpoint é autenticado por padrão; exceções usam `@Public()`. Autorização via `@RequirePermissions(...)`.

## Alternativas consideradas

- **Provedor gerenciado (Auth0, Clerk, WorkOS)** — SSO pronto, mas custo por usuário ativo e menor controle; reavaliar quando um cliente exigir SSO.
- **Keycloak self-hosted** — gratuito e completo, porém mais um serviço stateful para operar no MVP.
- **Sessão stateful em cookie** — simples, mas menos adequada para WebSocket, apps móveis e integrações de API.
- **Permissões dentro do JWT** — evitaria o cache, mas mudanças de cargo só valeriam após expirar o token.

## Consequências

- A segurança da autenticação é responsabilidade do time: exige rate limiting no login, fluxo seguro de recuperação de senha e testes específicos.
- O Redis passa a ser dependência do caminho de autorização (com fallback ao banco em caso de cache miss).
- Em qualquer cenário, RBAC e multitenancy permanecem no sistema: um provedor externo só substituiria a verificação de identidade.

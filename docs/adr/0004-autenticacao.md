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

## Adendo (2026-10-20) — cadastro público controlado e senha redefinida pela operação

Motivo: revisão pré-homologação (`docs/revisao-pre-homologacao-2026-10-20.md`, P0 2, 3 e 4). O cadastro público não tinha como ser desligado e todo cadastro cai no plano padrão, que libera tudo; até o `designate-root` (ADR 0009) as contas nasciam sem mãe; e não havia nenhuma forma de recuperar senha.

### Cadastro público

- **`PUBLIC_SIGNUP_ENABLED`** (padrão `true`, para não mudar o dev; a stack de produção usa `false` se o `.env.prod` não disser nada). Desligado, `POST /v1/auth/signup` responde **403 `SIGNUP_DISABLED`**. Convites e contas filhas não passam por essa regra.
- **Antes da raiz, só a primeira conta.** Com zero contas no banco, o cadastro aceita uma — a da plataforma, que vai virar raiz — **mesmo com o cadastro desligado**. Com alguma conta e nenhuma raiz, recusa tudo com **403 `SIGNUP_PLATFORM_NOT_READY`**. Regra pura em `accounts/domain/sign-up-policy.ts`; o `SignUpGate` (application) junta configuração e banco e serve ao cadastro e à consulta.
- **`GET /v1/auth/signup` → `{ enabled }`** (público, sem o motivo): o front esconde o link e a tela. O motivo aparece só no erro do POST — ele é de quem opera, não de quem visita.

Alternativas consideradas:
- *Recusar tudo antes da raiz e liberar por uma variável de "bootstrap"*: mais uma configuração para lembrar de desligar, e quem esquece fica com o cadastro aberto sem raiz — o problema original.
- *Comando que cria a conta da plataforma direto no banco*: elimina a janela do banco vazio, mas duplica o cadastro (usuário, cargos, vínculo) fora do fluxo testado. Fica para quando houver motivo.
- *O cadastro desligado também barrar a primeira conta*: obrigaria a subir com `true`, cadastrar, designar e redeployar com `false` — e entre o `designate-root` e o redeploy o cadastro fica aberto.

Armadilhas e limites:
- **Janela do banco vazio:** entre o deploy e o cadastro da plataforma, quem chegar primeiro cria a conta. O `docs/deploy.md` manda cadastrar logo em seguida e conferir que o `designate-root` adotou **0** contas.
- **Dois cadastros simultâneos no banco vazio passam os dois** (a decisão roda na transação, mas sem trava: `READ COMMITTED` não impede). Mesmo sinal: o `designate-root` adota 1. Se virar problema, um `pg_advisory_xact_lock` no `SignUpGate` resolve.
- Dev com contas e sem raiz passa a recusar o cadastro até alguém rodar o `designate-root` — é a regra, não um defeito.

### Senha redefinida pela operação

- Comando **`node dist/reset-password.js <email>`** (`src/reset-password.ts`, no padrão do `designate-root`; entra no `dist` pelo build normal, que compila todo o `src`). Usa o `ResetPasswordUseCase` (identity): senha temporária de 20 caracteres de um alfabeto sem ambíguos (`CryptoTemporaryPasswordGenerator`, ~116 bits), validada pelo `Password`, hash pelo mesmo `PasswordHasher` (Argon2id), e **revoga todas as sessões da pessoa em todas as contas** (banco na transação; lista de revogadas no Redis depois do commit). Imprime a senha uma vez; nada vai para log.
- **Sem rota HTTP de propósito:** sem confirmar a identidade por outro canal (e-mail), uma rota dessas entregaria qualquer conta. A confirmação da identidade é responsabilidade de quem roda o comando.

Pendente:
- Recuperação por e-mail (precisa de provedor de e-mail da plataforma — hoje cada conta configura o seu) e **troca da própria senha** no painel. Até lá, a senha temporária fica valendo indefinidamente.
- Senha temporária não obriga troca no próximo login (não há tela para isso).

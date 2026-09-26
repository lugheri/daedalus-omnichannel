# 0003 — Controle de acesso: memberships, cargos (RBAC) e equipes

- **Status:** Aceito
- **Data:** 2026-09-26

## Contexto

Cada tenant precisa controlar o que cada pessoa pode fazer, com cargos (RBAC). Em omnichannel há ainda uma segunda dimensão: sobre **quais dados** a pessoa atua (um agente vê as próprias conversas, um supervisor as da equipe). Pessoas como agências e consultores atendem várias empresas. A equipe da plataforma também precisa administrar os tenants.

## Decisão

### Entidades

- **User** — pessoa global, com um login (e-mail). Pode pertencer a vários tenants.
- **Tenant** — a conta/empresa cliente. Status: `trial`, `active`, `suspended`.
- **Membership** — vínculo User ↔ Tenant, com status (`invited`, `active`, `disabled`) e **um único cargo**.
- **Role (cargo)** — definido **por tenant**, com uma lista de permissões. Todo tenant nasce com os cargos padrão copiados de um template.
- **Permission** — **catálogo fixo no código**, no formato `recurso:ação` (ex.: `contacts:create`). Não é editável no banco.
- **Team (equipe)** — agrupa memberships; define escopo de dados e roteamento de conversas.

### Regras

- **Cargo define o que se pode fazer; equipe define sobre quais dados.** Os conceitos não se misturam.
- Permissões com escopo de dados têm variantes explícitas: `conversations:view:own`, `conversations:view:team`, `conversations:view:all`. O guard HTTP checa a permissão; o use case/query aplica o escopo.
- Cargos padrão: **Owner**, **Admin**, **Supervisor**, **Agent**. O Owner é de sistema (`isSystem`), não pode ser editado nem removido, e todo tenant tem ao menos um membership Owner ativo.
- **Administração da plataforma** é separada: campo `platformRole` no User, sem relação com cargos de tenant. Acesso de suporte a um tenant é feito por impersonation auditada.
- **Limites de plano** (nº de atendentes, canais) são *entitlements* do tenant, não permissões de RBAC.

### Módulos

- `identity` — users, credenciais e sessões.
- `accounts` — tenants, memberships, roles, teams e invitations.
- `memberships` guarda apenas o `userId` (sem relation do Prisma com `identity`).
- Futuramente, `audit` registra ações a partir de eventos dos demais módulos.

## Alternativas consideradas

- **User preso a um tenant** — mais simples, mas obriga um login por empresa para quem atende várias; migrar depois seria caro.
- **Múltiplos cargos por membership** — mais flexível, mas complica a interface e a explicação de "por que tenho acesso"; raramente necessário.
- **Permissões editáveis no banco** — rejeitado: só têm efeito se o código as verificar, então o catálogo pertence ao código.
- **ABAC completo** — excessivo para o MVP; o escopo own/team/all cobre a necessidade real.

## Consequências

- Uma pessoa faz um login e escolhe a conta; trocar de conta emite um novo token.
- Criar uma permissão nova exige deploy (entrada no catálogo + verificação no código) — é intencional.
- O modelo de contas pode ser revisto conforme o produto evoluir; mudanças serão registradas em um novo ADR.

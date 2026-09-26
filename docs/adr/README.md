# Architecture Decision Records

Registro das decisões de arquitetura do projeto. Cada ADR descreve o contexto, a decisão, as alternativas consideradas e as consequências.

ADRs não são editados depois de aceitos: quando uma decisão muda, cria-se um novo ADR que **substitui** o anterior, e o antigo recebe o status `Substituído por NNNN`.

| #                                       | Título                                                   | Status |
| --------------------------------------- | -------------------------------------------------------- | ------ |
| [0001](0001-monolito-modular.md)        | Monólito modular com Clean Architecture                  | Aceito |
| [0002](0002-multitenancy.md)            | Multitenancy por coluna `tenantId`                       | Aceito |
| [0003](0003-controle-de-acesso.md)      | Controle de acesso: memberships, cargos (RBAC) e equipes | Aceito |
| [0004](0004-autenticacao.md)            | Autenticação própria com JWT e refresh token rotativo    | Aceito |
| [0005](0005-refresh-token-em-cookie.md) | Refresh token em cookie HttpOnly e frontend SPA          | Aceito |

## Modelo

```markdown
# NNNN — Título

- **Status:** Proposto | Aceito | Substituído por NNNN
- **Data:** AAAA-MM-DD

## Contexto

## Decisão

## Alternativas consideradas

## Consequências
```

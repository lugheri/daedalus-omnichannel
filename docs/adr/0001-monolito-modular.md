# 0001 — Monólito modular com Clean Architecture

- **Status:** Aceito
- **Data:** 2026-09-26

## Contexto

A plataforma precisa nascer como um MVP enxuto (um backend e um frontend), mas deve poder escalar — inclusive separando partes em microsserviços — sem uma reescrita. Microsserviços desde o início trariam custo de rede, consistência eventual, deploys coordenados e observabilidade distribuída antes de existir necessidade real.

## Decisão

- **Backend como monólito modular** em **NestJS** (adapter Fastify), organizado em módulos de negócio com fronteiras rígidas: cada módulo é dono das suas tabelas, só expõe uma API pública (`index.ts`) e se comunica com outros módulos por facades ou eventos.
- **Clean/Hexagonal Architecture + DDD leve** dentro de cada módulo: `domain` (TypeScript puro) → `application` (use cases e ports) → `infra`/`http` (adapters).
- **Prisma** sobre Postgres, com um schema Postgres por módulo e sem relations entre módulos.
- **Event bus abstrato** (em memória no MVP) e outbox para eventos entre módulos, para que um módulo possa ser extraído trocando apenas o adapter do bus.
- A mesma imagem roda como **`api`** e **`worker`**, escalando HTTP e processamento de filas de forma independente.
- **Docker Swarm** para orquestração no MVP. A aplicação segue 12-factor e não tem nada específico de Swarm, para migrar a Kubernetes quando autoscaling (HPA/KEDA) for necessário.

## Alternativas consideradas

- **Microsserviços desde o início** — rejeitado: complexidade operacional sem demanda que a justifique.
- **Monólito sem fronteiras** (Express/Fastify puro) — rejeitado: a extração futura exigiria reescrita.
- **Fastify + Awilix em vez de NestJS** — viável e mais leve, mas o sistema de módulos e DI do Nest reforça as fronteiras que queremos e padroniza o código para um time em crescimento.
- **Kubernetes no MVP** — rejeitado por ora: o time domina Swarm, e a portabilidade da aplicação mantém a migração barata.

## Consequências

- Extrair um módulo para serviço próprio exige trocar o transporte de eventos e das facades, não reescrever regras de negócio.
- As fronteiras dependem de disciplina: o lint deve proibir imports internos entre módulos.
- Há mais arquivos e cerimônia do que num CRUD simples — é o custo aceito pela manutenibilidade.

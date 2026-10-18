# 0015 — Planos e limites (entitlements)

- **Status:** Aceito
- **Data:** 2026-10-20

## Contexto

A plataforma vende o sistema por mensalidade e terá revendedores (ADR 0009).
Até aqui toda conta podia tudo, e o único limite era uma constante (30
landing pages). O ADR 0003 já separava: o cargo diz o que **a pessoa** pode
fazer; limites de plano são do **tenant** (_entitlements_), não permissões.

Decisões de produto:

- planos num **catálogo editável pela plataforma** (sem deploy para mudar um
  limite ou criar uma oferta);
- quem troca o plano de uma conta: **a plataforma** (qualquer plano) e **o
  revendedor**, entre os planos que a plataforma liberar para revenda;
- **passar do limite bloqueia só o que é novo**: plano rebaixado não desliga
  nada do que a conta já tem;
- **cobrança fora do sistema** por enquanto (Pix/boleto manual; suspender por
  falta de pagamento usa o "suspender conta" que já existe).

## Decisão

- **Catálogo do que se limita, fixo no código** (como as permissões):
  `shared/domain/plan-entitlement.ts`.
  - Limites (quantos; `null` = sem limite): `members` (ativos + convites
    pendentes, sem os acessos da conta-mãe), `whatsappChannels`,
    `webChatChannels`, `forms`, `landingPages`, `childAccounts` (contas
    diretamente abaixo do revendedor).
  - Recursos (sim/não): `campaigns`, `automations`, `onlineBooking`,
    `abTesting`.
  - Item novo no catálogo = sem limite / sem o recurso nos planos gravados
    (o JSON antigo é completado na leitura), até a plataforma editar.
- **Planos no módulo accounts** (dono do tenant): tabela `accounts.plans`
  (nome, descrição, limites e recursos em JSON, "liberado para revenda",
  padrão, arquivado), sem tenant — é catálogo da plataforma. A conta aponta
  para o plano (`tenants.plan_id`); sem plano = **o padrão** (um só, índice
  único parcial). A migration cria o plano "Padrão" com tudo liberado (e as
  landing pages em 30, o limite que já valia): nada muda para quem já usa.
  A conta da plataforma não tem limite.
- **Verificação por uma porta compartilhada:** `PLAN_ENTITLEMENTS`
  (`shared/application/plan-entitlements.ts`), implementada pelo accounts e
  exportada pelo `AccountsModule`. Cada módulo conta o que é dele e pergunta
  `ensureRoom(limite, quantosJáTem)` ou `ensureFeature(recurso)`; a resposta
  negativa é 403 `PLAN_LIMIT_<LIMITE>` / `PLAN_FEATURE_<RECURSO>`. Só a
  **criação** passa pela verificação (convidar, reativar membro, criar canal,
  formulário, landing page, variante, campanha, automação, conta filha,
  ligar o agendamento online); editar, usar e desligar nunca.
- **Quem dá qual plano:** a plataforma, qualquer plano não arquivado; o
  revendedor, os não arquivados e liberados para revenda, só às contas da
  própria subárvore (também ao criar a conta). O plano que a conta já tem
  pode ficar mesmo arquivado. O catálogo (`/v1/plans`) exige `plans:manage`
  e a conta da plataforma.
- **Uso para a tela:** `GET /v1/plan` (qualquer membro) num módulo pequeno,
  `usage`, que junta o plano (accounts) e as contagens de cada módulo dono
  pelas facades — o accounts não depende dos outros módulos. O `/v1/me` traz
  o plano (limites e recursos) para a tela desligar o que não está incluso.

## Alternativas consideradas

- **Planos fixos no código:** simples, mas cada ajuste de oferta exigiria
  uma versão nova; testar preço e pacote é justamente o momento atual.
- **Limites como permissões (cargos):** misturaria "quem pode" com "o que a
  conta comprou" — o Owner de uma conta pequena teria permissões que o plano
  não cobre (ADR 0003).
- **Desligar o excedente ao rebaixar:** derrubaria atendimento (um número de
  WhatsApp a mais saindo do ar) por uma mudança comercial. Bloquear só o novo
  é previsível e não quebra nada.
- **Contar o uso em tabela própria (contadores):** rápido de ler, mas exige
  manter os contadores em sincronia com cada módulo; contar na hora é barato
  nesses volumes e não erra.
- **Gateway de pagamento agora:** fica para um passo próprio, quando o modelo
  de preço estiver decidido (os planos já dão onde pendurar a assinatura).

## Consequências

- Duas criações simultâneas podem passar juntas do limite por um (a contagem
  e a gravação não são atômicas). Aceitável para limites comerciais; se um
  dia precisar ser exato, a verificação vai para dentro da transação.
- Membros contam os convites pendentes: um convite esquecido ocupa lugar até
  ser revogado (a tela "Meu plano" mostra).
- Recurso tirado do plano não some da tela de quem já usa (campanhas antigas
  continuam visíveis; o agendamento ligado continua ligado), só não se cria
  de novo.
- A cobrança, o vencimento e o bloqueio por inadimplência continuam manuais.

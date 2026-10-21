# Revisão antes da homologação (20/10/2026)

Cinco agentes leram o código em paralelo, sem alterar nada: captação e
atendimento; sites, agenda e landing pages; contas, planos e segurança;
cobertura funcional do frontend; layout. **Nada foi testado rodando**: os
achados vêm da leitura do código, do typecheck e dos testes unitários.

## O que está bem

- **Isolamento entre contas sólido.** `tenantId` só do token, vínculo
  revalidado a cada requisição, ids de outra conta recusados com 404. A
  varredura não achou consulta que aceite id de outra conta.
- **Contratos front × back batem**: toda rota autenticada tem tela, nenhuma
  tela chama rota inexistente ou campo trocado.
- **Sites**: texto do cliente sempre escapado, links só `http(s)`, slug e
  domínio únicos entre contas.
- Typecheck do backend e do frontend limpos; lint do frontend limpo.
  **569 testes unitários passando** (captação 280, contas 200, sites 89).

## P0 — bloqueia a homologação

| # | Problema | Onde | Origem |
| --- | --- | --- | --- |
| 1 | **Não existe ambiente de homologação**: nenhuma stack, `.env` ou doc. Precisa de domínios (painel, API, sites), bucket de sites, token da Cloudflare, túnel, `NODE_ENV=production`, `TRUST_PROXY`, `CORS_ORIGINS`, extensão `btree_gist` no Postgres | `Docker/` | sites, contas |
| 2 | **Plano padrão libera tudo** e é o de todo cadastro novo. Criar o Básico e torná-lo padrão, ou fechar o cadastro público (hoje não há como desligá-lo) | migration `20261020100000_plans`, `plans.use-cases.ts:186` | contas |
| 3 | **`designate-root` precisa rodar logo após o deploy**: até lá o cadastro fica aberto e as contas nascem sem mãe | `src/designate-root.ts`, `docs/deploy.md:114` | contas |
| 4 | **Sem recuperação de senha** (nem troca da própria senha). Mínimo: procedimento manual documentado | não existe rota | contas, frontend |
| 5 | **O lead do formulário não pode ser atendido**: vira contato e negócio, mas não há como iniciar conversa. Mínimo: links `wa.me`, `tel:` e `mailto:` na ficha e no card | `conversations` | captação, frontend |
| 6 | **Ninguém é avisado de lead ou agendamento novo** (nem e-mail, nem contador) | — | frontend |
| 7 | **Agenda pública sem limite**: um IP marca ~600 horários por hora, já confirmados, cada um abrindo negócio | `public-booking.controller.ts:75-84`, `booking.use-cases.ts:308-336` | sites |
| 8 | **Conta suspensa continua no ar e recebendo** (site, agenda, chat, formulário) | `booking.use-cases.ts:181-186`, `forms/http/form-key.guard.ts` | sites, captação |
| 9 | **Diálogos longos sem rolagem no celular**: o formulário de agendamento pode ficar impossível de concluir | `components/ui/dialog.tsx:56` | layout |
| 10 | **Sem tela de erro nas rotas**: depois de um deploy, aba aberta cai na tela de erro em inglês | `app/router.tsx` | frontend |
| 11 | **Telefone do cliente no log** a cada mensagem recebida (LGPD) | `connector-reports.use-case.ts:92-95` | captação |
| 12 | **Concorrência**, no mínimo: negócio duplicado na entrada automática (unique parcial + dedup por `eventId`) e "assumir conversa" condicional | `kanban-auto-add.handler.ts:56-80`, `prisma-conversation.repository.ts:29-36` | captação |

### Andamento do P0 (20/10, correções por agentes; nada testado rodando)

| # | Situação |
| --- | --- |
| 1 | **Aberto** — passo do deploy, depende das diretrizes do ambiente |
| 2 | **Parcial** — `PUBLIC_SIGNUP_ENABLED` (padrão `false` na stack de produção). O plano padrão ainda libera tudo: criar o Básico e torná-lo padrão antes de abrir o cadastro |
| 3 | **Feito** — sem raiz designada, o cadastro só aceita a primeira conta (`SIGNUP_PLATFORM_NOT_READY` para as demais); ordem no `docs/deploy.md` |
| 4 | **Feito (manual)** — `node dist/reset-password.js <email>`: senha temporária + revoga as sessões. Sem fluxo por e-mail; a temporária não expira |
| 5 | **Feito (mínimo)** — botões WhatsApp/Ligar/E-mail na ficha, no negócio e no card. Atendimento acontece fora do sistema |
| 6 | **Feito (aproximação)** — contador no menu e no título da aba (conversas não lidas, negócios sem responsável), pelas rotas existentes; agendamentos novos ficaram de fora (faltaria `GET /v1/me/attention`) |
| 7 | **Feito** — até 2 agendamentos futuros pelo site por contato e 50 por conta/dia, com lock por conta; contato não é criado se o horário não for gravado |
| 8 | **Parcial** — formulário, agenda, chat e contagem das landings recusam conta suspensa. **Os sites publicados continuam no ar** (ADR 0010, "Conta suspensa"). Adaptador provisório em `shared/infra/prisma/prisma-account-standing.ts` deve ir para o `accounts` |
| 9 | **Feito** — diálogo com altura máxima e rolagem, rodapé fixo; `interactive-widget=resizes-content` |
| 10 | **Feito** — tela de erro em português; recarga automática uma vez em falha de chunk |
| 11 | **Feito** — telefone fora do log; máscara do descadastro por SMS corrigida. Risco residual: logs do Baileys e erros repassados |
| 12 | **Feito** — índice único parcial só para negócios da **entrada automática** (manual continua permitindo vários); claim condicional (409 ao segundo); conversa grava só as colunas alteradas. Pendente: responder sem responsável ainda assume sem condição; `unreadCount` ainda pode perder contagem |

Validação com tudo junto: backend `tsc` e lint limpos, **620 testes** passando;
frontend typecheck e lint limpos. A migration `20261020150000_deals_auto_entry`
nunca rodou.

## P1 — deveria entrar antes, se der

**Captação e atendimento**
- 9º dígito: o mesmo lead vira dois contatos (formulário × WhatsApp)
  (`shared/domain/phone-number.ts`, `message-normalizer.ts:65`).
- Atualização perdida em negócio (move × ganho), cancelamento de campanha
  ignorado, status de mensagem regredindo
  (`deals.use-cases.ts:310-369`, `prisma-campaign.repository.ts:27-55`,
  `prisma-outbound.repositories.ts:47-54`).
- Atendente com `conversations:view:own` exclui qualquer negócio da fila
  (`deals.controller.ts:47,107`).

**Contas e planos**
- Revendedor reativa conta suspensa pela plataforma; limite de contas contornável
  por aninhamento; plano padrão sempre liberado para revenda
  (`child-accounts.use-cases.ts:109-161`).
- Sem verificação de e-mail; convite não vai por e-mail (o link aparece uma vez
  para quem convida) — quem cria conta filha pode virar Owner dela.
- Bloqueio de login só por IP.
- Supervisor amplia o próprio escopo entrando em qualquer equipe.
- Teste e2e de isolamento (o ADR 0002 pede; não existe).

**Sites**
- `publish.sh` manual conflita com o módulo (apaga landings; slug fora do banco)
  — importa para o primeiro cliente, montado à mão.
- Trocar a chave do chat não derruba visitante antigo (diverge do ADR 0012).
- Contagem do teste A/B inflável; chave nova de chat/agenda só vale após
  republicar.

**Frontend**
- Erro da API aparece como "vazio"; páginas em branco sem tratamento de erro.
- Mensagem digitada se perde se o envio falhar
  (`conversation-chat.tsx:147-149`).
- Site perde alterações não salvas sem aviso.
- 10 ações destrutivas sem confirmação (tirar site do ar, suspender conta,
  trocar chave do chat…).
- Falha de rede na renovação do token desloga o usuário (`client.ts:91-96`).
- Campanhas somem a partir da 26ª (paginação ignorada).

**Layout (o mínimo para cliente real)**
- Menu do Básico enxuto e em linguagem de dono; "Owner/Admin/Agent" →
  "Dono/Administrador/Atendente"; menu filtrado por plano, não só por permissão.
- Cabeçalho do chat no celular: só "Resolver" visível, o resto num menu.
- Botões com 40–44 px no celular; esconder troca de conta com uma só conta.

## Depois

- Início acionável ("3 conversas esperando", "2 agendamentos hoje").
- Barra inferior no celular; agenda em lista; funil com rolagem por etapa.
- PWA: manifest, ícones, safe-area, service worker só da casca, push.
- Contraste do `--faint` e `focus-visible` na moldura.
- `platformRole` sem uso: hoje qualquer Admin da raiz controla a plataforma;
  auditoria das ações administrativas.
- Exclusão/anonimização de contato (LGPD); telas de perfil e dados da conta.
- Retry respeitando `Retry-After`; idempotência nos provedores; replay do webhook
  do SendGrid; HSTS/CSP nos sites; chave S3 separada para o bucket de sites.
- Roteiro de "primeiros passos"; formulário padrão já ligado ao site.

## Decisões de produto pendentes

1. **Atender o lead**: só links `wa.me`/`tel:` no Básico, ou iniciar conversa de
   WhatsApp pelo sistema (Baileys)?
2. **Aviso ao dono**: e-mail, notificação no navegador, ou só contador no menu?
3. **Cadastro público na homologação**: aberto ou fechado (contas criadas por
   nós)?
4. **Revenda na homologação**: vai ser usada? Se não, os itens de hierarquia
   saem do P1.
5. **Agenda online na homologação**: liga já (precisa do item 7) ou depois?

## O que nunca foi verificado

Nenhuma corrida foi reproduzida; nenhuma tela foi aberta; nginx, túnel,
certificado, S3, Postgres (constraint EXCLUDE) e Redis nunca rodaram juntos;
comportamento do WhatsApp com o 9º dígito e com contatos só-LID não medido.

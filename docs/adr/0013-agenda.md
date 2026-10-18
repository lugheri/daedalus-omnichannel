# 0013 — Agenda e agendamento online

- **Status:** Aceito
- **Data:** 2026-10-18

## Contexto

Os clientes do MVP são negócios de serviço com hora marcada (barbearias,
salões, clínicas, oficinas). O catálogo (serviços com duração, profissionais e
os serviços que cada um faz) já existe; falta a agenda: quem está livre
quando, marcar pelo painel e deixar o cliente marcar sozinho pelo site.

Decisões de produto:

- **A agenda é sempre de um profissional.** Quem atende sozinho se cadastra
  como profissional (o vínculo com o login é opcional).
- **Horário semanal por profissional + bloqueios** (férias, folgas,
  compromissos). Os horários livres saem disso, descontando os agendamentos,
  com a duração do serviço.
- **Pelo site, o cliente escolhe um horário livre e já fica confirmado** (sem
  "solicitação" para a equipe aprovar).

## Decisão

- **Módulo `scheduling`** (só na API), com tabelas próprias no schema
  `scheduling`: `professional_schedules` (horário semanal em JSON, por
  profissional), `time_offs`, `appointments` e `booking_settings` (uma por
  conta). Serviços e profissionais vêm do `CatalogFacade.agendaCatalog`
  (inclusive os inativos, para o histórico); o contato do `ContactsFacade`.
- **Sem dois agendamentos ao mesmo tempo para o mesmo profissional, garantido
  pelo banco:** `EXCLUDE USING gist (tenant_id WITH =, professional_id WITH =,
  tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'scheduled')`
  (extensão `btree_gist`). Duas marcações simultâneas no mesmo horário: uma
  passa, a outra recebe 409 `APPOINTMENT_SLOT_TAKEN` (o repositório traduz o
  erro 23P01). Intervalo semiaberto: terminar às 10h libera as 10h. Só
  agendamentos `scheduled` ocupam; cancelar, concluir ou marcar falta liberam
  o horário (desfazer o cancelamento esbarra em quem ocupou).
- **Agendamento guarda o que foi vendido:** nome e preço do serviço copiados
  na marcação; a duração vira `endsAt` (mudar o catálogo não muda o
  histórico; remarcar mantém a duração).
- **Fuso da agenda por conta** (`booking_settings.timezone`, padrão
  `America/Sao_Paulo`). O horário semanal é em minutos do dia no relógio da
  agenda; as contas usam só `Intl` (sem biblioteca de datas), recalculando o
  deslocamento uma vez perto da troca de horário de verão.
- **Horário padrão sem gravar:** profissional sem horário salvo usa seg–sex
  9h–12h e 13h–18h, sáb 9h–13h. A configuração da agenda também tem padrões
  sem gravar; a chave do widget só nasce na primeira gravação (antes disso, a
  API responde `publicKey: null`).
- **Painel pode encaixar** fora do horário (não pode sobrepor); as sugestões
  mostram só os livres. **O site só marca horário livre de verdade:** o
  servidor recalcula os livres na hora de marcar, respeitando antecedência
  mínima e janela de dias; com "qualquer profissional", tenta cada um livre
  naquele horário (se um conflito acontecer entre o cálculo e a gravação,
  tenta o próximo).
- **Agendamento online:** rotas `@Public` em `/v1/public/booking/:key`
  (página: serviços e profissionais marcados "mostrar no site"; horários
  livres; marcar). A chave pública diz a conta, como no chat do site (ADR
  0012); CORS aberto só nessas rotas, sem cookie; limite por IP; campo isca
  `website`. O visitante informa nome e WhatsApp ou e-mail e vira contato
  (origem `web_booking`). O widget é um script sem dependências servido pela
  API, desenhado num Shadow DOM dentro de `<div data-omni-booking>`.
- **No site da conta (ADR 0010):** seção `booking` no conteúdo (ligada por
  padrão). Com o agendamento ligado na agenda, o compositor injeta o script e,
  se o modelo não tiver o `<div data-omni-booking>`, cria uma seção antes do
  rodapé. O modelo inicial já tem a seção "Agende seu horário".
- **Funil:** `appointment.booked.v1` de agendamento feito pelo site abre um
  negócio nos funis que aceitam leads ("Corte — Joana", valor = preço), como
  o formulário de serviço. Agendamento do painel não abre negócio.
- **Permissões:** `agenda:manage` (ver o dia, marcar, remarcar, mudar a
  situação) para Admin, Supervisor e Agent; o horário dos profissionais e o
  agendamento online ficam com `catalog:manage`.

## Alternativas consideradas

- **Checar conflito só na aplicação** (ler e depois gravar): duas marcações
  simultâneas passariam. Trava por profissional (advisory lock) resolveria,
  mas a constraint é mais simples, vale para qualquer caminho de escrita e
  não depende de lembrar de travar.
- **Slots pré-gerados em tabela** (uma linha por horário): fácil de
  consultar, mas exige regenerar a cada mudança de horário, serviço ou
  bloqueio, e não lida bem com durações diferentes. Calcular na hora é barato
  no tamanho de um dia.
- **Solicitação de agendamento** (a equipe confirma): mais controle, mas o
  cliente final não sai da página com o horário garantido. Fica a opção de
  desligar o agendamento online e usar o formulário de solicitação de serviço.
- **Biblioteca de fuso (Luxon, date-fns-tz):** `Intl` resolve com poucas
  linhas e sem dependência, no backend e no widget.

## Consequências

- A migration cria a extensão `btree_gist` (precisa de permissão no Postgres
  gerenciado; está na lista de extensões confiáveis dos principais provedores).
- O Prisma não conhece a constraint: `migrate diff` não a recria nem a
  apaga, e o repositório reconhece o erro pelo nome/código.
- Mudar o fuso da conta muda o relógio dos horários semanais (os minutos são
  os mesmos, no fuso novo); agendamentos já marcados ficam no instante em que
  foram marcados.
- Lembretes (WhatsApp/e-mail antes do horário), recorrência e visão semanal
  ficam para depois. Os lembretes dependem do provedor de e-mail (passo 7).

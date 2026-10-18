# Captação de negócios sem site (ou com site fraco)

- **Status:** Modelo em validação; nada do produto construído
- **Atualizado:** 2026-10-07

Versão visual (jornada, fases e capacidades): `roteiro-captacao.html`, nesta
mesma pasta.

## A ideia em uma frase

Buscamos empresas locais que **não têm site** ou têm um **site fraco** e
oferecemos um site pronto, **hospedado pelo Daedalus** e já ligado ao CRM. O
site é o **gancho**: a receita recorrente vem da mensalidade, que sobe de plano
conforme o cliente passa a usar mais canais.

A promessa ao cliente é **aumentar a chance de ser encontrado e converter quem
já chega**. Não prometemos número de leads.

## Decisões

| # | Decisão | Por quê |
| --- | --- | --- |
| D1 | **O Daedalus hospeda os sites** | Amarra site e CRM (cancelou a assinatura, o site sai do ar) e resolve o formulário sem expor chave de API (A1) |
| D2 | **Três planos, vendendo só o Básico no começo** (revisado em 07/10; ver "Modelo de preço e planos") | O feedback dos clientes define os planos 2 e 3; loja de módulos confundiria |
| D3 | **Setup do site por faixa de complexidade**, à vista ou em 12× | Tabela curta; o nicho só indica a faixa padrão |
| D4 | **No teste, só subdomínio nosso** | Domínio próprio exige certificado HTTPS por domínio de cliente (A3) |
| D5 | **Validação feita pelo fundador**, por WhatsApp manual de um número separado; **depois, pelo menos 3 vendedores** | Barato, ensina as objeções e não arrisca o número de atendimento (A4) |
| D6 | **Nichos escolhidos por levantamento**, não por palpite | Ver "Validação" |
| D7 | **Receita Federal primeiro, Google depois** | A Receita dá o universo inteiro; o Google só para quem passar no filtro |

Princípio: **as fases são possibilidades, não compromisso.** Cada uma só começa
se os clientes pedirem ou se os números da anterior justificarem.

## Modelo de preço e planos (revisado em 07/10)

Decisões de 07/10, ainda sujeitas ao feedback dos primeiros clientes:

- **Três planos, sem loja de módulos.** Uma loja de módulos avulsos deixa a
  escolha confusa para o pequeno negócio; três níveis são mais fáceis de
  entender e de vender.
- **Vender só o plano Básico nos primeiros meses** e montar os planos 2 e 3
  pelo que os clientes pedirem. Registrar, por cliente, **o que pediu e não
  tinha** (etiqueta no CRM do próprio Daedalus); com 10 a 20 clientes, a
  lista define o conteúdo e o preço dos outros planos.
- **Twilio como provedor inicial** do que falta: WhatsApp oficial (a Twilio
  já é provedora autorizada da Meta, então não depende do processo de Tech
  Provider) e e-mail marketing (SendGrid Marketing Campaigns; o SendGrid já
  está integrado para e-mail transacional). O consumo (conversas, SMS) é
  repassado.
- **Quase todas as funcionalidades já existem** em sistemas do fundador
  (agenda, PBX, campanhas, páginas de captura, teste A/B, redes sociais);
  faltam WhatsApp oficial e e-mail marketing. Trazer cada uma para o Daedalus
  é integração, não construção do zero, mas ainda é trabalho: só depois do
  feedback.

### Plano Básico (o que se vende primeiro)

- Site, e-mail, CRM com funil de vendas, agenda, gestão de contatos.
- WhatsApp não oficial: **talvez fique fora da oferta** (termos do WhatsApp e
  risco de banimento). Se ficar, oferecer como "conexão WhatsApp" com termo de
  ciência do risco. Sem ele, o pacote perde boa parte do apelo para esse
  público.
- Sugestão: até 3 usuários incluídos, usuário extra cobrado à parte.

### Preço: dois modelos para testar

| | Modelo A | Modelo B |
| --- | --- | --- |
| Oferta | Site em 6 × R$ 300 + sistema R$ 197 desde o 1º mês; do 7º mês em diante, só R$ 197 (que já inclui a hospedagem do site) | R$ 297/mês, site incluso, sem taxa de criação, fidelidade de 12 meses |
| Meses 1 a 6 | R$ 497/mês | R$ 297/mês |
| Depois | R$ 197/mês | R$ 297/mês |
| 1º ano por cliente | ~R$ 4.164 | ~R$ 3.564 |

Referência de valor: montar site, e-mail, CRM, agenda e WhatsApp com
ferramentas avulsas custaria ~R$ 300 a 800 por mês (faixas aproximadas, a
conferir); R$ 197 fica abaixo da metade disso.

Simulação mês a mês com churn: `simulador-precos.html`, nesta pasta. Com as
premissas conservadoras (210 ligações por mês, B convertendo 1,5× o A), os dois
empatam em 12 meses (~R$ 59 mil × ~R$ 61 mil) e B abre vantagem em 24 meses
(~R$ 166 mil × ~R$ 212 mil). **B só compensa se converter pelo menos ~1,45× o A
em 12 meses, ou ~1,18× em 24 meses**: o teste precisa dividir as ligações entre
as duas ofertas e medir isso.

Projeção do fundador sozinho, 10 ligações por dia, Modelo A: ~R$ 28 mil
(pessimista), ~R$ 59 mil (conservador) e ~R$ 84 mil (moderado) em 12 meses. É
escala de validação; o crescimento vem dos outros canais (parceiros, clientes
do sistema de agenda, indicações, vendedores).

### Produto de entrada (ideia)

Um plano mais barato (site simples + formulário, sem agenda e sem CRM completo)
para o MEI que não paga R$ 497 por mês, servindo de porta para subir de plano.
Depende de sentir o mercado.

### Planos 2 e 3 (a definir pelo feedback)

Candidatos, todos fora da oferta inicial: WhatsApp oficial, SMS, e-mail
marketing, PBX, criador de campanhas (com ou sem IA), editor de páginas de
captura publicadas em subdomínio do cliente, teste A/B das páginas, integração
com redes sociais, pedido automático de avaliação no Google. Esboço de valores
discutido em 07/10 (não decidido): Crescimento ~R$ 347 e Completo ~R$ 547.

Programa de parceiros: `programa-de-parceiros.md`, nesta pasta.

### Planos por fase (versão de 06/10, substituída acima)

A tabela abaixo é a escada anterior, mantida como histórico.

#### Setup do site (uma vez)

| Faixa | O que inclui | À vista | Parcelado |
| --- | --- | --- | --- |
| Essencial | Uma página: serviços, fotos, avaliações, mapa, WhatsApp, formulário | R$ 497 | 12× R$ 49,90 (R$ 598,80) |
| Profissional | Várias seções ou páginas: procedimentos, equipe, perguntas frequentes, galeria | R$ 697 | 12× R$ 69,90 (R$ 838,80) |
| Sob medida | Catálogo ou integração (imóveis, portais) | a partir de R$ 997 | a definir |

Tecnicamente, a faixa é só quais seções do template ficam ligadas. O parcelado
sai cerca de 20% mais caro que o à vista.

#### Mensalidade por plano

| Plano | Fase | Preço | O que acrescenta |
| --- | --- | --- | --- |
| 1 | Site + presença | **R$ 59,90/mês** | Site hospedado, e-mail, Perfil do Google, CRM básico (formulários, gestão de leads) |
| 2 | Omnichannel | **R$ 99,90/mês** + pacotes | WhatsApp não oficial, SMS e discagem. Pacote de SMS e pacote de minutos à parte. WhatsApp oficial sem preço ainda |
| 3 | Campanhas com IA | **R$ 199,90/mês** | Campanhas e conteúdo gerados com IA. Preço a validar pelo custo da IA |
| 4 | Canais oficiais | **R$ 249,90/mês** | WhatsApp oficial, Facebook, Instagram e outros integrados. Preço a validar pelo custo da IA |
| 5 | Anúncios | sem preço | Meta Ads e Google Ads. Sem dados para calcular ainda |

## Fases do produto

Cada fase é o que o produto precisa ter para vender aquele plano. Marcações:
**existe** (já está no Daedalus), **construir**, **manual** (serviço feito por
nós no começo).

### Fase 1 — Site + e-mail + Google Maps + CRM básico (R$ 59,90)

Vender o primeiro site e mostrar ao dono quem procurou a empresa.

- **construir** Módulo de sites: templates por nicho com as seções ligadas por
  faixa; HTML gerado ao publicar, guardado no S3, servido no subdomínio. A
  decisão de arquitetura vira ADR próprio.
- **construir** Formulário público por conta, com anti-spam, caindo como lead
  `web_form` (sem chave de API, A1).
- **construir** Origem do lead: de onde veio a visita (Google, Instagram,
  anúncio) e o clique no botão de WhatsApp (A10).
- **construir** Tela de leads não tratados e contagem de visitas e leads por
  site.
- **construir** Planos como _entitlements_ do tenant.
- **existe** Entrada de leads com origem, kanban com automações, tabulações.
- **existe** Envio de e-mail (SendGrid). Ver P1: "e-mail" no plano ainda não
  está definido.
- **manual** Configuração do Perfil da Empresa no Google (Google Maps).
- **manual** Prévia do site da empresa abordada e cobrança.

**Antes de escalar com vendedores** (o que segura o cancelamento e a operação):

- **construir** Relatório mensal ao cliente: visitas, leads por origem, tempo
  de resposta.
- **construir** Alerta de lead parado e follow-up automático pelo kanban.
- **construir** Editor simples para o cliente (ou o vendedor) preencher o site:
  com 27 a 48 vendas por mês, montar site à mão não escala.
- **construir** Cobrança automática, inclusive do parcelado.
- **construir** Domínio próprio, com certificado sob demanda (A3).

### Fase 2 — Omnichannel: WhatsApp, SMS e discagem (R$ 99,90 + pacotes)

- **existe** WhatsApp não oficial (Baileys), SMS (Twilio), caixa de entrada,
  equipes, descadastro.
- **construir** Pacotes de SMS e de minutos: saldo por tenant, consumo e
  bloqueio ao zerar.
- **construir** **Discagem.** O Daedalus não tem telefonia (ver P2).
- **construir** WhatsApp oficial (Cloud API), quando o processo de Tech
  Provider da Meta for concluído. Sem preço ainda.

### Fase 3 — Campanhas com IA (R$ 199,90)

O cliente escolhe um objetivo ("mais agendamentos esta semana") e o sistema
monta a campanha: posts, story, página do site, mensagem e follow-up no CRM.

- **construir** Perfil da marca: logo, cores, fontes, tom de voz, serviços,
  fotos.
- **construir** Texto por modelo de linguagem, atrás de uma interface própria
  para poder trocar de provedor.
- **construir** Templates de post por nicho, montados com as fotos do cliente e
  convertidos em imagem; imagem gerada por IA só como upgrade.
- **construir** Calendário e cota de geração por plano. **O preço depende do
  custo da IA por cliente**: medir antes de fixar.
- Publicação: o cliente baixa e posta. Publicar direto entra na Fase 4.

### Fase 4 — Canais oficiais integrados (R$ 249,90)

- **construir** WhatsApp oficial, Facebook e Instagram (mensagens e
  publicação) pelas APIs da Meta: depende de aprovação do app pela Meta.
- **construir** Gestão do Perfil do Google pela API e o "apareceu X vezes este
  mês": depende de pedido de acesso aprovado pelo Google.
- Cada cliente precisa autorizar as próprias contas.

### Fase 5 — Anúncios Meta e Google (sem preço)

- **construir** Anúncios como mais uma origem de lead no mesmo funil.
- **construir** Relatório "orgânico × Instagram × Google × anúncios".
- Gestão dos anúncios: integrar, ou oferecer como serviço à parte.

## Validação (antes e durante a Fase 1)

### Etapa A — Levantamento (em andamento)

Descobrir quais nichos têm mais empresas ativas sem site.

- **Receita Federal primeiro:** a base aberta de CNPJ dá todas as empresas
  ativas do nicho na cidade, com idade, telefone e e-mail.
- **Google depois**, por empresa, só para as filtradas: tem site, nota,
  avaliações. Cada busca da Places API traz no máximo 60 resultados, por isso
  ela não serve para definir o universo.
- **Cidades:** Sorocaba primeiro; depois São Paulo por bairro (Pinheiros,
  Tatuapé, Santana, Santo Amaro, Itaquera, Campo Limpo, Penha, Lapa, Ipiranga,
  Vila Prudente) e outras do interior.
- Imobiliárias e corretores entram no levantamento; entrar no levantamento não
  é entrar no teste.

Script: `C:\Developer\Daedalus\Prospeccao\receita\levantar.mjs` (fora deste
repositório). Nichos e CNAEs em `nichos.json` ao lado. Base bruta em
`D:\Developer\Daedalus\receita-cnpj\<mês>`. Uso:
`node levantar.mjs --cidade SOROCABA [--uf SP] [--mes 2026-09]`.

**Resultado — Sorocaba, base de 2026-09** (16.260 estabelecimentos ativos nos
11 nichos):

| Nicho | Ativas | Com nome fantasia | Com celular | E-mail gratuito | Nome + celular + 2 anos ou mais |
| --- | ---: | ---: | ---: | ---: | ---: |
| Barbearia/salão | 4.727 | 3% | 67% | 83% | 67 |
| Oficina | 2.444 | 17% | 63% | 77% | 144 |
| Estética | 2.211 | 9% | 66% | 85% | 90 |
| Eletricista | 1.834 | 13% | 70% | 81% | 110 |
| Pet | 1.498 | 26% | 62% | 78% | 141 |
| Imobiliária/corretagem | 1.031 | 72% | 53% | 45% | 264 |
| Advocacia | 903 | 16% | 53% | 44% | 39 |
| Dentista | 563 | 66% | 51% | 54% | 111 |
| Contabilidade | 563 | 76% | 40% | 35% | 143 |
| Ar-condicionado | 451 | 17% | 70% | 84% | 34 |
| Dedetização | 35 | 74% | 34% | 29% | 7 |

Leitura:

- **"Ativa" na Receita não é negócio funcionando.** Em barbearia/salão, só 3%
  têm nome fantasia: a maioria é MEI de uma pessoa (o CNAE 9602-5/01 junta
  cabeleireira, manicure e barbearia). A última coluna é o retrato mais
  realista de negócio estabelecido.
- **Sem nome fantasia não dá para procurar no Google.** O nome desses está só
  na razão social, em outro arquivo da base (Empresas, ~1,4 GB), que no MEI
  contém o CPF do dono e precisa ser descartado na leitura.
- **E-mail gratuito não separa quem tem site** (77% a 85% em todos os nichos de
  serviço). Quem decide é o Google.
- **30% das imobiliárias e dos dentistas têm o e-mail do contador** no
  cadastro: o contador concentra esses clientes, e pode ser canal de venda.

Armadilhas da base da Receita:

- O código de município é **da Receita**, não do IBGE.
- Bairro é texto livre e bagunçado; para bairros da capital, usar o **CEP**.
- **Celular no formato antigo:** 8 dígitos sem o 9 na frente. Celular é 8
  dígitos começando com 6–9 (ou 9 começando com 9). Ignorar isso deu 0% de
  celular na primeira rodada.
- E-mail repetido em 3 ou mais empresas é do **contador**, não da empresa.
- Corretor de imóveis autônomo muitas vezes não tem CNPJ e não aparece.
- A base é do Brasil inteiro (não há arquivo por estado), sai uma por mês e o
  servidor da Receita derruba conexões longas: o script retoma o download de
  onde parou.

### Etapa B — Teste de venda (fundador, sozinho)

- Cerca de 90 abordagens (30 por nicho), com os templates dos 3 nichos.
- O funil de venda roda num tenant nosso do Daedalus.
- **Medir:** resposta → site vendido → assinatura → continua pagando no 2º e 3º
  mês; e em quantos dias cada nicho compra.
- **Leitura:** 5 vendas em 90 é sinal interessante; 10, excelente. Com 30 por
  nicho, a diferença entre nichos ainda é sorte.
- **Capital × interior:** comparar a região num nicho só, ou o teste cresce.
- **Opcional — URA do Janus como triagem:** discar para ~300 empresas por nicho
  com uma mensagem curta ("quer ver como ficaria o site da sua empresa? tecle
  1"). Mede interesse comparado entre nichos, não disposição de comprar. Antes:
  prefixo 0303 de telemarketing (Anatel), lista de bloqueio do Procon-SP, e
  número diferente do que depois vai abordar como humano.

### Etapa C — Vendedores

Contratar pelo menos 3 vendedores **só com dois números reais do teste**: a
conversão das abordagens e o cancelamento dos primeiros clientes depois de 2 a
3 meses.

Projeção (chutes, até o teste trazer números reais), começando com ~15
clientes após 3 meses de validação:

| | Conservador | Moderado |
| --- | ---: | ---: |
| Abordagens por vendedor por mês | 300 | 400 |
| Conversão | 3% | 4% |
| Clientes novos por mês (3 vendedores) | 27 | 48 |
| Cancelamento por mês | 5% | 4% |
| Teto da base (novos ÷ cancelamento) | 540 | 1.200 |
| Tempo até 300 clientes, desde o início | ~20 meses | ~11 meses |

Sozinho, no cenário conservador (6 clientes novos por mês, 5% de cancelamento),
a base **para em 120** e nunca chega a 300.

- **O setup paga o vendedor:** 27 sites por mês à vista são ~R$ 13.400 só de
  setup. Não dar desconto no setup para fechar venda. Com o parcelado, essa
  receita entra em 12 meses, e o caixa da contratação muda (P4).
- **Remuneração:** fixo baixo + comissão por site + bônus pelo cliente que
  continua pagando no 3º mês.
- **Gargalos com vendedores:** produção de sites (editor da Fase 1), um número
  de WhatsApp por vendedor, implantação e suporte do primeiro mês, e a lista de
  prospecção (Sorocaba tem ~1.150 empresas "nome + celular + 2 anos" nos 11
  nichos; acaba rápido).

## Nichos

Critérios: depende de WhatsApp, cada cliente novo vale um dinheiro razoável, o
dono decide rápido, é comum não ter site, um site simples gera resultado e o
funil cabe no kanban que já existe.

**Hipótese**, a confirmar com o levantamento: **oficinas**, **clínicas de
estética** e **autônomos de serviço** (eletricista, ar-condicionado,
dedetização…). Os números de Sorocaba também colocam **pet** e **dentista** na
conversa.

- **Oficina e autônomos:** novo orçamento → avaliação → orçamento enviado →
  aprovado → serviço concluído.
- **Clínica:** novo contato → respondido → avaliação agendada → fechado.

**Barbearias:** fáceis de abordar, mas o gancho natural é agendamento, que o
Daedalus não tem, e o segmento é disputado por apps de agendamento baratos.

**Imobiliárias:** o site é catálogo de imóveis e o mercado espera integração com
portais; sistemas como Kenlo e Jetimob já vendem site + CRM + portais juntos. O
**corretor autônomo** é a porta de entrada mais provável; imobiliária com equipe
vira produto próprio.

## Ideia futura: base da Receita como enriquecimento no produto

Enriquecer os contatos que a conta já tem (atividade, porte, abertura,
endereço, situação) e, mais adiante, oferecer listas de prospecção.

- A base pode ser reutilizada comercialmente (dado aberto), mas fazer revisão
  jurídica antes de vender.
- **LGPD:** expor **só nome e contato**, nunca CPF; sócios fora; registrar a
  origem e atender pedido de exclusão.
- **Dados do Google não entram no banco:** os termos da Places API proíbem
  guardar e revender (só o `place_id`).
- Lista de prospecção + WhatsApp não oficial = disparo em massa: precisa de
  travas.
- Atualização: base mensal, aplicada de forma incremental pelo CNPJ; para o dado
  do dia, consultar uma API pública de CNPJ na hora.

## O que já existe no Daedalus

Conferido no código em 05/10/2026:

- **Entrada de leads:** `POST /v1/public/leads`
  (`Backend/src/modules/contacts/http/leads-intake.controller.ts`), com origem
  `web_form` e campanha, sem duplicar contato.
- **Origem do lead** (`whatsapp`, `manual`, `import`, `web_form`) e detalhe
  livre.
- **Kanban com automações** e **tabulações obrigatórias**.
- **WhatsApp via Baileys**, e-mail (SendGrid) e SMS (Twilio) com descadastro e
  campanhas.

**Não existe:** hospedagem de sites, planos e cobrança no `Tenant`, visão de
leads não tratados, contagem de visitas, telefonia/discagem, IA.

## Armadilhas

- **A1. A chave de API não pode ir para a página.** O `/v1/public/leads` é
  servidor a servidor. Como o site é nosso (D1), o formulário vai para a
  plataforma, que sabe de qual conta ele é; precisa de limite por IP e
  anti-spam.
- **A2. O Google precisa conseguir ler o site.** O front é uma SPA em React; o
  site do cliente precisa ser HTML pronto.
- **A3. Domínio próprio exige certificado sob demanda.** O Traefik atual não faz
  bem; Caddy ou Cloudflare for SaaS fazem. E o domínio fica em nome de quem?
- **A4. Abordar pelo WhatsApp não oficial derruba o número.** Número separado,
  mensagens uma a uma, nunca disparo em massa.
- **A5. Dados do Google têm custo e regras.** Places API paga por consulta;
  raspar o Maps viola os termos.
- **A6. "Sem site" no Google não é "sem site".** Instagram e Linktree fazem as
  vezes de site; conferir antes de abordar.
- **A7. Saúde tem regra de publicidade** (CFM/CFO: antes/depois, preço).
- **A8. A mensalidade depende de o site gerar lead.** A contagem de visitas e
  leads precisa estar visível desde o primeiro mês.
- **A9. LGPD.** Registrar a origem do dado e oferecer como não receber mais
  contato.
- **A10. O clique no WhatsApp perde a origem.** A conversa começa fora do site;
  o botão precisa passar por um link nosso (ou levar mensagem pré-preenchida)
  para registrar de onde veio.
- **A11. Parcelado é crédito.** No 12×, o cliente pode parar de pagar no 3º mês
  com o site entregue. Cobrar no cartão por um intermediador (que antecipa o
  valor, com taxa) protege o caixa; carnê ou boleto mensal deixa o risco com a
  gente. O site hospedado pode sair do ar por inadimplência, mas isso precisa
  estar no contrato.
- **A12. Discagem é infraestrutura nova.** Ver P2.

## Em aberto

- **P1. O que é o "e-mail" do plano 1?** E-mail profissional
  (`contato@empresa.com.br`) exige domínio próprio, que ficou fora do teste
  (D4), e um provedor de caixa de e-mail. Envio de e-mail pelo CRM (SendGrid)
  já existe.
- **P2. De onde vem a discagem da Fase 2?** O Daedalus não tem telefonia.
  Caminhos: integrar com o Janus (mas é outra empresa e outro produto),
  provedor de voz por API (Twilio Voice e similares, custo por minuto em dólar)
  ou Asterisk próprio. Define o custo do pacote de minutos.
- **P3. Fase 1 sem WhatsApp no CRM.** O WhatsApp não oficial saiu do plano de
  R$ 59,90 (antes era complemento de R$ 29,90) e foi para o de R$ 99,90. O
  botão do site leva ao WhatsApp do próprio dono, mas a conversa não entra no
  CRM. Conferir se o cliente da Fase 1 vê valor no CRM sem as conversas.
- **P4. Caixa do parcelado.** Com setup em 12×, a receita que pagaria os
  vendedores entra diluída em 12 meses.
- **P5.** Limites de cada plano: usuários, contatos, leads, envios de IA.
- **P6.** Preço do WhatsApp oficial e dos pacotes de SMS e minutos.
- **P7.** Custo da IA por cliente, para validar os planos 3 e 4.
- **P8.** Nichos do teste, cidades do interior e capital × interior.
- **P9.** Quem produz o conteúdo de cada site (textos, fotos) e em quanto tempo.
- **P10. Versão mobile do painel como PWA** (a projetar, 07/10). Pontos já
  levantados: instalação na tela inicial sem loja; notificação de lead novo por
  Web Push (no iPhone só com o PWA instalado, iOS 16.4+, então o onboarding
  precisa ensinar a instalar); cache offline só para a "casca" do app, nunca
  para dados do CRM. O front (React + Vite) não tem nada de PWA hoje.

## O que nunca foi testado

Só o levantamento da Receita rodou (Sorocaba, 06/10). Nenhuma peça do produto
existe, nenhuma abordagem foi feita, nenhum número de conversão ou cancelamento
é real.

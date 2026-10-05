# Captação de negócios sem site (ou com site fraco)

- **Status:** Decidido o modelo; nada construído
- **Data:** 2026-10-05

## A ideia em uma frase

Buscamos no Google empresas locais que **não têm site** ou têm um **site
fraco** e oferecemos um site pronto, **hospedado pelo Daedalus** e já ligado ao
CRM. O site é o **gancho**: a receita recorrente vem da mensalidade, que inclui
hospedagem, CRM e acompanhamento dos leads que o site gera.

## Decisões

| # | Decisão | Por quê |
| --- | --- | --- |
| D1 | **O Daedalus hospeda os sites** | Amarra site e CRM (cancelou a assinatura, o site sai do ar) e resolve o formulário sem expor chave de API (ver A1) |
| D2 | **Mensalidade de R$ 59, com hospedagem** | Site + hospedagem + formulário + CRM de leads num preço só |
| D3 | **Site com preço por faixa de complexidade**; o nicho só indica a faixa padrão | Tabela curta e preço justificável quando um cliente pede mais que o padrão do nicho |
| D4 | **No teste, só subdomínio nosso** | Domínio próprio exige certificado HTTPS por domínio de cliente (ver A2): fica para depois |
| D5 | **Abordagem feita pelo próprio fundador, por WhatsApp manual, de um número separado** | Barato, ensina as objeções na prática e não arrisca o número de atendimento (ver A4) |
| D6 | **Nichos escolhidos por levantamento, não por palpite** | Ver a Fase 0 do plano |

## Oferta e preços

### Site (pagamento único)

| Faixa | O que inclui | Preço | Nichos típicos |
| --- | --- | --- | --- |
| Essencial | Uma página: serviços, fotos, avaliações, mapa, WhatsApp, formulário | R$ 497 | autônomos, oficinas, barbearias |
| Profissional | Várias seções ou páginas: procedimentos, equipe, perguntas frequentes, galeria | R$ 697 | clínicas, dentistas, contadores |
| Sob medida | Catálogo ou integração (imóveis, portais) | a partir de R$ 997 | imobiliárias, fora do teste |

Tecnicamente, a faixa é só quais seções do template ficam ligadas.

### Mensalidade e complementos

| Item | Preço | Situação no código |
| --- | --- | --- |
| Site hospedado + formulário + CRM de leads | R$ 59/mês | CRM existe; hospedagem de sites não |
| Acompanhamento dos leads (não tratados, em andamento etc.) | incluso | kanban existe; visão de não tratados não |
| WhatsApp não oficial (Baileys) | + R$ 29,90/mês | existe |
| WhatsApp oficial (Cloud API) | a definir | depende do processo de Tech Provider da Meta |
| Gestão de anúncios, publicação nas redes, publicação patrocinada | — | não começou; fora do MVP |

## Nichos

Critérios para um nicho entrar: depende de WhatsApp, cada cliente novo vale um
dinheiro razoável, o dono decide rápido, é comum não ter site, um site simples
gera resultado e o funil cabe no kanban que já existe.

**Hipótese** (a confirmar na Fase 0): **oficinas/centros automotivos**,
**clínicas de estética** e **autônomos de serviço** (dedetização,
ar-condicionado, eletricista, vidraçaria…). O funil deles já é um kanban:

- **Oficina e autônomos:** novo orçamento → avaliação → orçamento enviado →
  aprovado → serviço concluído.
- **Clínica:** novo contato → respondido → avaliação agendada → fechado. A dor
  é o lead que pergunta o preço e fica horas sem resposta, e a automação de
  "tempo parado" do kanban já ataca isso.

**Por que não barbearias primeiro**, apesar de serem fáceis de abordar: o
gancho natural é agendamento, que o Daedalus não tem, e o segmento já é
disputado por apps de agendamento baratos ou grátis.

**Imobiliárias:** entram no levantamento da Fase 0, mas a oferta para elas é
outra conversa:

- O site de imobiliária é **catálogo de imóveis** (faixa sob medida), e o
  mercado espera integração com os portais (ZAP/Viva Real, OLX…), distribuição
  de leads entre corretores e um CRM mais complexo.
- **A concorrência já vende site + CRM juntos.** Os sistemas imobiliários do
  mercado (Kenlo, Jetimob e similares) entregam site, CRM e envio aos portais
  num pacote. É provável que a imobiliária que **tem** site o tenha por um
  desses sistemas, e a proposta de valor precisa vencer isso, não um site
  ruim.
- **O corretor autônomo** é outro público: tende a ter menos site e menos
  sistema, e decide sozinho. Pode caber numa oferta mais simples (página
  pessoal + imóveis em destaque + WhatsApp), mais perto da faixa Profissional.

Enquanto o levantamento não mostrar o contrário, o corretor autônomo é a porta
de entrada mais provável no setor; a imobiliária com equipe vira produto
próprio, numa fase posterior.

## Plano de ação

### Fase 0 — Escolher os nichos (sem código no produto)

- **Cidade: São Paulo.**
- Script com a Google Places API: para 8 a 10 nichos candidatos, levantar
  quantas empresas aparecem, quantas não têm site, a mediana de avaliações e
  quantas têm celular cadastrado.
- **Armadilha:** cada busca da Places devolve **no máximo 60 resultados**, e
  São Paulo tem milhares de empresas por nicho. Uma busca "oficina em São
  Paulo" traz só as 60 mais relevantes, que tendem a ser justamente as que já
  têm site. O levantamento precisa ser **por amostra de bairros** (os mesmos
  bairros para todos os nichos, misturando centro e periferia) e comparar
  **proporções** (% sem site), não totais.
- **Bairros da amostra:** Pinheiros, Tatuapé, Santana, Santo Amaro, Itaquera,
  Campo Limpo, Penha, Lapa, Ipiranga e Vila Prudente.
- **Interior de SP:** algumas cidades entram também, para comparar com a
  capital (cidades a definir). O levantamento mostra só a **proporção sem
  site**; se o interior é **mais receptivo** só aparece no teste (Fase 2), nas
  respostas às abordagens.
- **Imobiliárias entram no levantamento**, separadas em "imobiliária" e
  "corretor de imóveis" (autônomo). Medir é barato e informa a decisão; entrar
  no levantamento **não** é entrar no teste. Ver "Imobiliárias" na seção de
  nichos.
- Escolher os 3 nichos com a maior proporção de empresas ativas e sem site.
- **Precisa:** uma chave da Places API (criada pelo fundador no Google Cloud,
  em variável de ambiente). Pendente.

**Decisão (05/10): a Receita Federal vem primeiro, o Google depois.** A base
aberta de CNPJ define o universo (todas as empresas ativas do nicho na região,
sem o limite de 60 por busca) e já traz idade da empresa, telefone e e-mail. O
Google entra só para as empresas que passarem no filtro, consultado **por
empresa**, para saber se tem site, nota e avaliações. Por isso o filtro da
Receita precisa reduzir a lista a algumas centenas, para caber na cota
gratuita.

O que a base da Receita tem e as armadilhas de cada campo:

- **Nicho** = CNAE principal (e os secundários).
- **Município:** código da **própria Receita**, que **não** é o código do IBGE.
  Cruzar com outra base exige a tabela de municípios que vem junto.
- **Bairro:** texto livre, sem padrão ("V PRUDENTE", "VILA PRUDENTE",
  "VL. PRUDENTE"). Para os bairros da capital, o **CEP** é mais confiável que o
  nome.
- **Telefone:** DDD + número; 9 dígitos começando com 9 indica celular,
  provável WhatsApp.
- **E-mail:** sinal grátis de site. Domínio próprio (`@oficinax.com.br`)
  sugere que a empresa tem site; `@gmail`/`@hotmail` sugere que não. Ajuda a
  priorizar quem consultar no Google.
- **Data de início da atividade:** idade da empresa.
- **MEI:** a razão social costuma conter o nome e o CPF do dono, que é dado
  pessoal (LGPD). Não guardar além do necessário.
- **Formato:** arquivos mensais em vários ZIPs (vários GB), CSV com `;`,
  codificação latin1 e sem cabeçalho. Processar filtrando por UF = SP e pelos
  CNAEs durante a leitura, sem carregar tudo.
- **Telefone no formato antigo:** a maioria dos celulares está com 8 dígitos,
  sem o 9 na frente. Celular é 8 dígitos começando com 6–9 (ou 9 dígitos
  começando com 9).

Script: `C:\Developer\Daedalus\Prospeccao\receita\levantar.mjs` (fora deste
repositório). Base bruta em `D:\Developer\Daedalus\receita-cnpj\<mês>`.

**Primeiro resultado — Sorocaba, base de 2026-09** (16.260 estabelecimentos
ativos nos 11 nichos):

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

Leitura e armadilhas:

- **"Ativa" na Receita não é negócio funcionando.** Em barbearia/salão, só 3%
  têm nome fantasia: a maioria é MEI de uma pessoa (cabeleireira, manicure,
  muitas atendendo em casa; o CNAE 9602-5/01 junta tudo isso). O número de
  estabelecimentos com fachada é muito menor que o total.
- **Sem nome fantasia não dá para procurar no Google pelo nome.** O nome desses
  está só na razão social, que fica em outro arquivo da base (Empresas) e, no
  MEI, contém o CPF do dono, que precisa ser descartado.
- **E-mail gratuito é sinal fraco de "sem site":** fica entre 77% e 85% nos
  nichos de serviço e não diferencia quase nada. Quem decide é o Google.

### Fase 1 — O mínimo para vender (desenvolvimento)

1. **Módulo de sites:** templates por nicho com as seções ligadas por faixa;
   HTML gerado ao publicar, guardado no S3 e servido no subdomínio. A decisão de
   arquitetura vira ADR próprio.
2. **Formulário e botão de WhatsApp do site** caindo como lead `web_form` na
   conta do cliente, sem chave de API.
3. **Prévia para a abordagem:** um site de exemplo com nome, fotos e avaliações
   da empresa abordada ("olha como ficaria o seu"). No teste, montada à mão no
   template; automatizar a partir do perfil do Google só se a abordagem
   converter.
4. **Visão de leads não tratados** e **contagem de visitas e leads por site**:
   é o que prova ao cliente que a mensalidade vale.
5. **Plano de R$ 59 com o complemento de WhatsApp** como _entitlement_ do
   tenant; cobrança manual no início.

### Fase 2 — Teste

- Cerca de 90 abordagens (30 por nicho), com os templates dos 3 nichos prontos.
- O funil de venda roda num tenant nosso do Daedalus: os prospects são
  contatos, as etapas são colunas do kanban.
- **Medir:** resposta → site vendido → assinatura → continua pagando no 2º mês.
  E quanto tempo cada nicho leva para comprar.
- **Leitura:** 5 vendas em 90 é sinal interessante; 10, excelente; 15 ou mais
  justifica automatizar. Com 30 por nicho, a diferença entre nichos ainda é
  sorte: o teste diz **se** vende e **por quê**, não qual nicho venceu.
- **Capital × interior:** se o teste também comparar regiões, cada combinação
  de nicho e região fica com 15 abordagens ou menos. Para a comparação valer
  alguma coisa, ou o teste cresce, ou se compara a região num nicho só.

### Fase 3 — Depois do teste

- Prospecção automatizada com pontuação de oportunidade (ver abaixo).
- Domínio próprio do cliente.
- Cobrança automática.
- Só então anúncios, redes sociais e publicação patrocinada.

### Pontuação de oportunidade (Fase 3)

Ordenar as empresas encontradas pela chance de compra. O que dá para medir
automaticamente:

| Sinal | Fonte |
| --- | --- |
| Sem site cadastrado | Places API |
| Site lento ou não responsivo | PageSpeed API (gratuita), rodando no site encontrado |
| Muitas avaliações / nota alta | Places API |
| Telefone celular cadastrado | Places API |

"Instagram ativo", "empresa com mais de 3 anos", "ticket médio" e "WhatsApp
disponível" **não saem de nenhuma API**: ou entram à mão, ou ficam fora da
pontuação.

## Ideia futura: base da Receita como enriquecimento no produto (fora do MVP)

A base de CNPJ que usamos na Fase 0 pode virar funcionalidade do Daedalus:
**enriquecer os contatos** que a conta já tem (atividade, porte, data de
abertura, endereço, situação cadastral a partir do CNPJ) e, mais adiante,
oferecer listas de prospecção.

Cuidados já identificados (05/10):

- **A base pode ser reutilizada comercialmente** (dado aberto; Econodata,
  Speedio, Casa dos Dados e outros vivem disso). Mesmo assim, fazer revisão
  jurídica antes de vender.
- **LGPD:** em MEI e empresário individual, nome, CPF (dentro da razão social),
  telefone e e-mail são do dono, ou seja, dado pessoal, mesmo sendo público.
  Decisão: expor **só nome e contato**, nunca CPF; sócios ficam fora; registrar
  a origem do dado e atender pedido de exclusão.
- **Dados do Google não entram no banco.** Os termos da Places API proíbem
  guardar e revender os dados (só o `place_id` pode ser guardado). Site, nota e
  avaliações precisam ser consultados na hora, e cada consulta tem custo.
- **Lista de prospecção + WhatsApp não oficial = disparo em massa.** Se a lista
  for oferecida aos clientes, o produto precisa de travas (limite de envio,
  descadastro obrigatório), senão a plataforma vira sinônimo de spam e os
  números são banidos.
- **Público diferente:** lista de prospecção atende quem vende para empresas
  (agências, vendedores B2B, contadores), não o pequeno negócio do teste.
  Enriquecer os contatos que a conta já tem serve aos dois.

## O que já existe no Daedalus e serve a isto

Conferido no código em 05/10/2026:

- **Entrada de leads:** `POST /v1/public/leads`
  (`Backend/src/modules/contacts/http/leads-intake.controller.ts`). Aceita
  nomes de campo em português e inglês, não duplica contato e grava a origem
  `web_form` com a campanha.
- **Origem do lead** (`whatsapp`, `manual`, `import`, `web_form`) e um detalhe
  livre: base do relatório "de onde vieram meus leads".
- **Kanban com automações** (mensagem, atribuição, mover por evento e por tempo
  parado) e **tabulações obrigatórias ao resolver**.
- **WhatsApp via Baileys**, e-mail (SendGrid) e SMS (Twilio) com descadastro
  (`OptOut`) e campanhas.

**Não existe:** hospedagem de sites, planos e cobrança no `Tenant`, visão de
leads não tratados, contagem de visitas.

## Armadilhas

- **A1. A chave de API não pode ir para a página.** O `/v1/public/leads` é
  autenticado pela chave da conta e é servidor a servidor. Como o site é
  hospedado pelo Daedalus (D1), o formulário é enviado para a própria
  plataforma, que já sabe de qual conta ele é. Mesmo assim precisa de limite
  por IP e anti-spam (honeypot ou captcha): é um formulário público.
- **A2. O Google precisa conseguir ler o site.** O front atual é uma SPA em
  React, que o Google indexa mal. Os sites dos clientes precisam ser HTML
  pronto (gerado ao publicar), não uma tela do app.
- **A3. Domínio próprio exige certificado sob demanda.** O Traefik da stack não
  emite bem certificado HTTPS para domínios de clientes que entram a qualquer
  momento; o Caddy (TLS sob demanda) ou o Cloudflare for SaaS fazem isso.
  Adiado pelo D4, mas condiciona a Fase 3. E fica uma pergunta: o domínio fica
  em nome de quem?
- **A4. Abordar pelo WhatsApp não oficial derruba o número.** Mensagem fria
  para desconhecidos por número conectado ao Baileys é o padrão que o WhatsApp
  bane. Por isso D5: número separado, mensagens escritas uma a uma, nunca
  disparo em massa, nunca o número de atendimento nem o de cliente.
- **A5. Dados do Google têm custo e regras.** O caminho legítimo é a Places
  API, paga por consulta e com prazo para guardar os dados (o `place_id` pode
  ser guardado). Raspar o Google Maps viola os termos e é bloqueado.
- **A6. "Sem site" no Google não é "sem site".** Muita empresa tem site e não
  cadastrou no perfil, ou usa Instagram/Linktree como site. Conferir antes de
  abordar.
- **A7. Saúde tem regra de publicidade.** Clínica com responsável médico ou
  dentista segue as regras do CFM/CFO sobre fotos de antes/depois e preço no
  anúncio. Conferir as regras vigentes antes de montar esses templates.
- **A8. A mensalidade depende de o site gerar lead.** Se o site não trouxer
  contatos, o CRM fica vazio e o cliente cancela. A contagem de visitas e
  leads (Fase 1, item 4) precisa estar visível desde o primeiro mês.
- **A9. LGPD.** Contato comercial com empresa usando dado público pode se
  apoiar em legítimo interesse, mas precisa registrar a origem do dado e
  oferecer como não receber mais contato.

## Em aberto

- **Chave da Places API** para a Fase 0 (cidade decidida: São Paulo).
- **Cidades do interior** que entram na comparação com a capital.
- **Como dividir as ~90 abordagens** entre capital e interior sem diluir
  demais a amostra (ver Fase 2).
- **Nichos** do teste: dependem da Fase 0.
- **Domínio próprio** (Fase 3): em nome de quem, e o que acontece com ele no
  cancelamento.
- **Limites do plano de R$ 59:** usuários, contatos, leads por mês?
- **Preço do WhatsApp oficial:** depende do custo por conversa da Meta.
- **Quem produz o conteúdo** de cada site (textos, fotos) e quanto tempo leva.

## O que nunca foi testado

Tudo neste documento é plano. Nenhuma peça da Fase 1 existe, nenhuma
abordagem foi feita e nenhum número de conversão é real.

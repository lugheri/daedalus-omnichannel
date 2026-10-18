# 0014 — Landing pages e teste A/B

- **Status:** Aceito
- **Data:** 2026-10-19

## Contexto

As contas fazem campanhas (Dia dos Pais, Black Friday, uma promoção de
inauguração) e precisam de uma página focada na oferta, que leve ao
formulário, e de saber qual versão da página converte mais. O site da conta
(ADR 0010) é uma página única da empresa, servida estática pelo nginx a
partir do bucket público (ADR 0008).

Decisões de produto:

- a landing page fica **num caminho do endereço do site** da conta
  (`barbearia.sites.com/dia-dos-pais/`, e no domínio próprio, se houver);
- é montada a partir de **modelos de landing** mantidos pela plataforma,
  como os do site;
- o teste A/B tem **variantes com escolha manual** do vencedor (o painel
  mostra os números e quando a diferença é confiável);
- **conversão = formulário enviado**.

## Decisão

- **Modelos com tipo.** `templates.kind`: `site` ou `landing` (não muda
  depois de criado; os marcadores são outros). Cada tipo tem o seu modelo
  inicial e o seu exemplo na prévia do editor. O site só escolhe modelo de
  site, a landing só de landing (`SITE_TEMPLATE_WRONG_KIND`).
- **Landing page no módulo `sites`** (mesmo contexto: páginas publicadas no
  bucket, modelos, imagens, compositor). Tabelas `landing_pages`,
  `landing_variants`, `landing_views` e `landing_conversions` no schema
  `sites`. A página tem nome, caminho (único na conta), o formulário da
  conversão e de 1 a 4 variantes; cada variante tem letra (`a`–`d`), modelo,
  conteúdo e peso. Os dados da empresa (nome, logo, cor, WhatsApp) vêm do
  site da conta; o conteúdo da variante é a oferta (capa, texto, benefícios,
  preço, depoimentos, dúvidas). O site precisa existir, mas não precisa estar
  no ar.
- **Teste A/B estático.** O nginx dos sites não sabe de teste: tudo é
  arquivo no bucket.
  - Uma variante com peso: `<pasta>/<caminho>/index.html` é a própria
    variante.
  - Duas ou mais: o `index.html` do caminho sorteia a variante pelos pesos
    (uma vez por navegador, guardada no `localStorage`) e redireciona para
    `/<caminho>/<letra>/`, mantendo a query (UTM) e o `#`. Sem JavaScript,
    vai para a primeira.
  - Variante que sai do teste vira redirecionamento para o caminho (link
    compartilhado continua funcionando). Tirar do ar apaga exatamente o que
    foi gravado: a página guarda as pastas, o caminho e as letras publicadas.
- **Contagem.** Visita: a variante publicada avisa a API
  (`POST /v1/public/landing/views/:variante`, sem corpo, `mode: no-cors`, sem
  cookie) uma vez por navegador, variante e dia; a API soma num contador por
  dia (`INSERT … ON CONFLICT … + 1`). Conversão: o formulário da variante
  posta com `?ref=lp:<variante>`; o módulo forms guarda essa origem
  (`form_submissions.source_ref`, opaca para ele) e a repassa no
  `form.submitted.v1`; o módulo sites grava a conversão com o id do envio
  como chave (evento repetido não conta duas vezes) e confere que a variante
  é da conta do envio.
- **Comparação.** Cada variante é comparada com a A por um teste de duas
  proporções (z, bicaudal): "poucas visitas" abaixo de 100 por variante,
  "confiável" com p < 0,05. A conta escolhe a vencedora: ela fica com peso
  100 e as outras com 0 (guardadas, com os números); no ar, publica na hora.
  "Recomeçar contagem" zera os números da página.
- **Endereço acompanha o site.** As landing pages moram nas pastas do site:
  o slug publicado (ou o atual, com o site fora do ar) e o domínio próprio
  publicado. Quando o site muda de endereço, entra ou sai do ar, as landing
  pages no ar são publicadas de novo (vão para a pasta nova; o link "voltar
  ao site" aparece ou some).

## Alternativas consideradas

- **Sorteio no servidor** (nginx com `split_clients` ou um serviço na
  frente): sem o redirecionamento extra, mas os pesos mudam por página e
  pela tela; exigiria configuração dinâmica ou um serviço com estado na
  frente de páginas que hoje são arquivos. O redirecionamento custa uma ida
  a mais, com o `index.html` em cache.
- **Trocar o conteúdo no navegador** (`document.write` da variante): sem
  mudar a URL, mas frágil com scripts e ruim de depurar.
- **Analytics de terceiros** (GA, pixels): fica a cargo da conta no modelo;
  a contagem própria basta para o teste e não depende de consentimento de
  cookies (não há cookie nem dado pessoal).
- **Editor de blocos** em vez de modelos: mais flexível, bem mais trabalho
  de construir e de manter bonito; fica para depois, se os modelos não
  bastarem.
- **Vencedor automático:** a decisão fica com a conta (às vezes a "pior"
  variante é a desejada por outro motivo); o painel só diz quando a
  diferença é confiável.

## Consequências

- O índice das páginas fica em cache no nginx por até 60 s: mudar pesos ou
  escolher a vencedora leva até um minuto para valer.
- A visita é contada pelo navegador: robôs sem JavaScript não contam, e quem
  limpa o `localStorage` conta de novo no mesmo dia. Suficiente para comparar
  variantes (o erro é o mesmo para todas).
- Mudar o conteúdo de uma variante no meio do teste mistura números de
  versões diferentes: o painel oferece "Recomeçar contagem".
- Quantas landing pages e se há teste A/B são do plano da conta (ADR 0015).
- Uma landing no domínio sem www (`barbearia.com.br/promo`) cai no
  redirecionamento da raiz do domínio (ADR 0011) e perde o caminho; os links
  devem usar o host principal.

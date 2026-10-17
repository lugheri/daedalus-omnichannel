# 0010 — Módulo de sites: modelos com marcadores e publicação pela fila

- **Status:** Aceito
- **Data:** 2026-10-17

## Contexto

O ADR 0008 pôs os sites dos clientes no ar na nossa infraestrutura (bucket
público + nginx em `<slug>.SITES_DOMAIN`), com publicação manual pelo
`publish.sh`. Ficou pendente o módulo que monta os sites: com dezenas de
vendas por mês, montar site à mão não escala, e o dono (ou quem gerencia a
conta, ADR 0009) precisa editar o próprio site.

O site é simples e parecido entre clientes do mesmo nicho: capa, sobre,
serviços, equipe, fotos, depoimentos, dúvidas, contato com formulário e mapa.
Serviços, profissionais e formulários já existem no CRM (catálogo e forms).

## Decisão

- **Modelo = um documento HTML com marcadores Mustache** (`{{business.name}}`,
  `{{#services}}…{{/services}}`), escrito na tela pela **conta da plataforma**
  (só a raiz mantém modelos, por enquanto). O modelo é público para as contas
  quando marcado "disponível"; rascunho só quem mantém vê. Modelo novo nasce
  com um modelo inicial completo (página única, sem JavaScript).
- **O conteúdo é da conta, não do modelo:** um JSON único (empresa, aparência,
  capa, seções ligadas, fotos, depoimentos, dúvidas, formulário, SEO) que
  serve para qualquer modelo — trocar de modelo muda só a aparência. Serviços
  e profissionais vêm do catálogo (os marcados "mostrar no site") e o
  formulário, do módulo forms, na hora de gerar.
- **O "view" entregue ao modelo é um contrato** (`site-view.ts`): só se
  acrescenta campo. Seção ligada **e** com conteúdo vira `sections.x = true`,
  para o modelo não repetir a regra.
- **Sem lógica no modelo e texto sempre escapado:** Mustache (sem expressões,
  sem partials); `{{x}}` escapa `& < > " '`. O único HTML sem escape que o
  sistema oferece é o formulário pronto (`{{{contactForm.html}}}`), montado e
  escapado por nós.
- **Um site por conta**, no endereço `<slug>.SITES_DOMAIN` (slug único entre
  todas as contas, com palavras reservadas; o endereço ainda no ar também
  conta como ocupado).
- **Rascunho e publicado:** editar grava o rascunho; **publicar vai para a fila
  `sites`** (o worker gera o HTML e grava `<slug>/index.html` no bucket
  público). O job não carrega o "quê": o site guarda `pendingAction`
  (publicar/tirar do ar) e o worker faz o que estiver pendente — job
  repetido ou fora de ordem não desfaz o pedido mais recente. A edição e o
  estado da publicação são gravados separadamente, para uma não desfazer a
  outra.
- **Imagens:** original no bucket privado (com backup) e cópia pública em
  `media/<tenant>/<id>.<ext>` no bucket de sites, servida em
  `media.SITES_DOMAIN` (o slug `media` é reservado) — a prévia já mostra a
  imagem antes de publicar. Só JPEG, PNG, WebP e GIF até 5 MB (SVG fica de
  fora: pode carregar script).
- **Prévia** = o mesmo renderizador da publicação, devolvendo o HTML para um
  `iframe` com `sandbox="allow-scripts"` sem `allow-same-origin` (origem
  opaca: o script do modelo não alcança o painel nem a sessão).
- **Configuração:** `SITES_BUCKET` e `SITES_URL` (`https://{slug}.dominio`),
  mesmo endpoint e chaves do S3 privado (chaves próprias opcionais). Sem eles,
  editar e ver a prévia funcionam; publicar e enviar imagem recusam.

## Alternativas consideradas

- **Seções fixas no código** (modelos escritos por nós, sem editor): mais
  controle de qualidade, mas modelo novo exige deploy. Pode conviver: um modelo
  "oficial" pode ser só um modelo da conta raiz.
- **Construtor visual de blocos** (estilo Wix): bem mais trabalho; faz sentido
  junto das páginas de captura (landing pages) e do teste A/B.
- **Gerar o HTML na hora de cada visita** (servidor de sites falando com a
  API): acopla os sites à API e ao banco, e perde o que o ADR 0008 ganhou
  (site estático no ar mesmo com a API fora).
- **Handlebars/Liquid**: têm lógica (helpers, filtros) que o modelo não
  precisa e que aumenta o que pode dar errado num modelo.

## Consequências

- Mudar um modelo não muda os sites no ar: cada site pega a versão nova na
  próxima publicação. Catálogo também: serviço novo aparece ao publicar de novo.
- O nginx dos sites guarda o HTML por até 60 s (ADR 0008): após publicar,
  trocar o endereço ou tirar do ar, a mudança leva até 1 minuto para aparecer.
- Excluir uma imagem que o site no ar ainda usa a tira do ar também (a tela
  avisa para publicar de novo); a que o rascunho usa não pode ser excluída.
- **Domínio próprio do cliente** (`www.empresa.com.br`) continua pendente
  (ADR 0008): fica para o próximo passo, com o certificado emitido pelo DNS da
  Cloudflare.
- Em dev, o compose sobe o mesmo nginx em `http://<slug>.localhost:8088`.

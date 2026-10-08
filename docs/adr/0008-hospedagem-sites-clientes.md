# 0008 — Hospedagem dos sites dos clientes na própria infraestrutura

- **Status:** Aceito
- **Data:** 2026-10-07

## Contexto

O produto de captação para negócios locais (`docs/produto/`) vende um site
pronto junto com o sistema: o site é hospedado por nós e sai do ar se o cliente
cancelar. O primeiro cliente chegou antes do módulo de sites existir, e o site
dele precisa ir para o ar num subdomínio nosso até ter domínio próprio.

Os sites são **estáticos**: HTML, CSS, imagens. Sem PHP, banco ou WordPress.

## Decisão

- **Os sites rodam na nossa infraestrutura**, num serviço próprio do Swarm
  (`sites`), numa **stack separada** (`Docker/sites/stack.sites.yaml`):
  publicar ou mexer nos sites não toca na API nem no painel.
- **Arquivos num bucket S3 público dedicado** (`SITES_BUCKET`), uma pasta por
  site (`<slug>/index.html`). O serviço é um nginx sem estado que lê do bucket;
  nada fica no disco do container além de cache descartável.
- **Endereço: `<slug>.SITES_DOMAIN`**, num **domínio separado** do painel. O
  Traefik roteia qualquer subdomínio com uma regra curinga (`HostRegexp`), e o
  nginx tira o slug do primeiro rótulo do host. Site novo não exige mexer em
  Traefik nem em DNS.
- **Certificado curinga** (`*.SITES_DOMAIN`) pelo Let's Encrypt com desafio de
  DNS na **Cloudflare** (resolver `lesites` no Traefik, token em Docker secret).
- **Cloudflare na frente** (proxy), com SSL em modo *Full (strict)*.
- **Publicação**, enquanto o módulo não existe: `Docker/sites/publish.sh <slug>
  <pasta>`, que sincroniza a pasta com o bucket e grava o `Cache-Control` (HTML
  60 s, demais arquivos 1 dia).
- O nginx guarda **cache local com `proxy_cache_use_stale`**: se o S3 falhar, o
  último conteúdo continua no ar.

## Alternativas consideradas

- **Uma hospedagem contratada por cliente:** R$ 15 a 30 por mês cada,
  um painel e uma senha por cliente, e o site fora do nosso controle (o que
  quebra a amarração site + sistema). Rejeitada.
- **Servir os sites pelo container do painel ou pela API:** mistura um conteúdo
  público de terceiros com a aplicação e acopla os deploys. Rejeitada.
- **Arquivos num volume do servidor:** quebra a regra de containers sem estado
  e não funciona com mais de um nó. Rejeitada.
- **Subdomínios do domínio do painel** (`<slug>.app.dominio`): o painel usa
  cookie `SameSite=Strict`, e sites no mesmo domínio contariam como "mesmo
  site" para o navegador. Um domínio separado isola cookies e reputação (é o
  que fazem github.io e vercel.app). Rejeitada.
- **Hospedagem estática de terceiros (Cloudflare Pages, Netlify):** funciona,
  mas cada site vira um projeto lá e o domínio próprio depende da conta deles.
  Pode voltar à mesa se a infraestrutura própria virar gargalo.
- **Certificado por subdomínio pelo desafio TLS:** com `HostRegexp` o Traefik
  não sabe os nomes para pedir, e cada site novo seria um certificado (limite
  semanal do Let's Encrypt). Rejeitada em favor do curinga.

## Consequências

- Custo por site praticamente zero: arquivos estáticos e cache.
- **A Cloudflare entra na infraestrutura:** o DNS do `SITES_DOMAIN` precisa
  estar nela e o Traefik passa a exigir o secret `cf_dns_api_token`, inclusive
  no deploy da stack principal.
- O servidor continua sendo ponto único de falha, mas com a Cloudflare e o
  cache do nginx os sites estáticos aguentam quedas curtas melhor que a API.
- **O bucket de sites é público:** nunca pode receber nada privado. Os dados
  que geram os sites (textos, fotos originais) ficam no bucket privado e no
  Postgres, que já têm backup.

## Pendências

- **Formulário do site:** o endpoint público por conta (doc de produto, A1)
  ainda não existe. A ideia é `<form method="post">` direto para a API, sem
  JavaScript nem CORS, voltando para uma página de obrigado.
- **Domínio próprio do cliente:** o Traefik não emite certificado sob demanda
  para domínios que entram a qualquer momento. Caminhos: Cloudflare for SaaS
  (custom hostnames) ou Caddy com TLS sob demanda na borda. Decidir quando o
  primeiro cliente pedir.
- **Módulo de sites:** templates por nicho e geração do HTML ao publicar
  substituem o `publish.sh` manual.
- **O que acontece no cancelamento** (prazo de aviso, entrega dos arquivos):
  questão de contrato.

## O que nunca foi testado rodando

Nada desta decisão rodou ainda: nem o nginx com o template, nem o certificado
pela Cloudflare, nem o `publish.sh` contra o provedor de S3. O primeiro deploy
precisa conferir, nesta ordem: o certificado curinga emitido, um site de teste
abrindo, a página interna sem extensão, o 404 e o site continuando no ar com o
S3 indisponível.

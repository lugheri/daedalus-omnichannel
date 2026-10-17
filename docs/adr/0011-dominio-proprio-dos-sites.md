# 0011 — Domínio próprio dos sites pelo túnel da Cloudflare

- **Status:** Aceito
- **Data:** 2026-10-17

## Contexto

Os sites das contas ficam em `<slug>.SITES_DOMAIN` (ADR 0008 e 0010). O
cliente quer o próprio domínio (`www.barbearia.com.br`). O ADR 0008 deixou
isso pendente: o Traefik não emite certificado sob demanda para domínios que
entram a qualquer momento.

Os domínios dos clientes são registrados pela plataforma, e o DNS fica na
conta da Cloudflare dela (decisão de produto). Ou seja: toda zona de cliente
está na nossa Cloudflare.

## Decisão

- **Os domínios próprios chegam por um Cloudflare Tunnel** (`cloudflared` na
  stack dos sites, `Docker/sites`). O túnel abre conexões de saída para a
  Cloudflare e entrega **qualquer host** ao nginx dos sites (regra de ingress
  sem hostname). Para ligar um domínio, basta o DNS dele (na nossa Cloudflare)
  apontar por CNAME, com proxy, para `<id-do-túnel>.cfargotunnel.com`.
- **O HTTPS é o da Cloudflare, na borda** (Universal SSL da zona): nenhum
  certificado por domínio no Traefik, nenhuma porta nova aberta, nada de
  configuração dinâmica no proxy.
- **O nginx escolhe a pasta pelo host:** subdomínio nosso → pasta do slug (como
  antes); qualquer outro host → pasta com o nome do próprio host
  (`www.barbearia.com.br/`). Host que ninguém publicou dá 404.
- **O site guarda o domínio** (`customDomain`, único entre as contas, com e sem
  www). Publicar grava o HTML também na pasta do domínio, mais:
  - `/.well-known/daedalus-site.txt` com o id do site, **sem cache** — é por ele
    que o worker verifica, pelo próprio domínio, se o DNS já chega no site
    (pendente → verificando → conectado / ainda não chega);
  - no domínio sem www, uma página que redireciona para o www (meta refresh
    imediato + canonical).
  Trocar ou tirar o domínio tira a pasta antiga do ar na próxima publicação. O
  canonical do site passa a ser o domínio; o endereço nosso continua valendo.
- **Só quem gerencia a conta define o domínio:** o acesso da conta-mãe (ADR
  0009) ou a própria conta da plataforma. O dono vê o domínio e o estado. Como o
  DNS é da plataforma, isso também impede que uma conta "reserve" o domínio de
  outro cliente.
- **Configuração:** `SITES_TUNNEL_ID` no `.env.prod` (o `deploy.sh` passa
  `SITES_DOMAIN_TARGET` = `<id>.cfargotunnel.com` para o painel mostrar o
  destino do CNAME); credenciais do túnel no secret `cf_tunnel_credentials`.
  Em dev não há túnel: domínios de teste como `www.loja.teste.localhost` abrem
  direto no nginx, e `SITES_DOMAIN_CHECK_VIA` faz a verificação conectar nele.

## Alternativas consideradas

- **Traefik com rotas dinâmicas** (provider HTTP lendo os domínios da API) e
  certificado por domínio pelo desafio de DNS: funciona, mas exige um endpoint
  interno protegido, um certificado do Let's Encrypt por domínio e o Traefik
  dependendo da API para montar rotas.
- **Caddy com TLS sob demanda** na borda dos sites: resolve o certificado, mas
  divide as portas 80/443 com o Traefik (repasse por SNI) e é mais um proxy
  para operar.
- **Cloudflare for SaaS (custom hostnames):** feito para quando o DNS é do
  cliente; aqui o DNS é nosso, e passa de 100 domínios é pago por domínio.
- **Modo "Full" sem verificar o certificado da origem:** tráfego cifrado mas
  origem não autenticada. Descartado.

## Consequências

- A Cloudflare passa a ser obrigatória também para os domínios próprios (já
  era para o domínio dos sites, ADR 0008). Mudar de provedor de DNS/borda
  exige outra forma de certificado.
- Ligar um domínio ainda tem passos manuais na Cloudflare (adicionar a zona,
  os dois CNAMEs). A API da Cloudflare permite automatizar isso depois.
- O túnel é uma conexão de saída: o servidor não precisa de nada aberto para os
  domínios próprios, e o túnel sobe em qualquer orquestrador (não é código da
  aplicação).
- O mesmo domínio não pode estar em dois sites, nem um com www e outro sem.
- Os subdomínios `*.SITES_DOMAIN` continuam pelo Traefik com o certificado
  curinga; podem passar pelo túnel no futuro, se quisermos um caminho só.

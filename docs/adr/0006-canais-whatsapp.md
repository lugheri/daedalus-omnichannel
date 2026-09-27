# 0006 — Canais de WhatsApp: API oficial e Baileys (conector próprio)

- **Status:** Aceito
- **Data:** 2026-09-27

## Contexto

A plataforma atenderá WhatsApp por dois caminhos:

- **API oficial (WhatsApp Cloud API)**, com a empresa atuando como **Tech Provider** da Meta (processo em andamento): a Meta envia eventos para um webhook HTTP; cada cliente conecta sua conta (WABA) e o envio usa um token por empresa. É **sem estado** do nosso lado.
- **Não oficial, via [Baileys](https://github.com/WhiskeySockets/Baileys)**: nós mantemos uma **conexão WebSocket persistente por número**, pareada por QR code, com chaves de criptografia que mudam a cada mensagem. É **com estado**, e só pode existir **uma** conexão por número.

O MVP começa com cerca de 10 clientes, cientes de que usarão o canal não oficial. O Baileys é, portanto, o caminho crítico do produto no início.

## Decisão

### Módulo `channels` e abstração de provedor

- Um port de provedor com adapters por tecnologia (`baileys`, `whatsapp-cloud`; outros no futuro).
- Tudo é normalizado em eventos internos versionados — mensagem recebida, status de mensagem (enviada/entregue/lida/falhou), estado da conexão — e em comandos de envio. O módulo `conversations` **nunca** conhece o provedor.
- Credenciais e segredos dos canais (tokens da Meta, sessão do Baileys) são **criptografados no banco** com chave da aplicação (`ENCRYPTION_KEY`), com rotação prevista.

### Cloud API (sem estado)

- Um único webhook da aplicação (modelo Tech Provider), com validação da assinatura `X-Hub-Signature-256`; o canal é identificado pelo `phone_number_id` e dele se chega ao tenant.
- O webhook só valida, enfileira o payload bruto e responde 200; o processamento é do `worker`, idempotente (dedup pelo id da mensagem da Meta).
- Onboarding dos clientes via Embedded Signup, quando o processo de Tech Provider for concluído.

### Baileys: processo `whatsapp-connector`

- **Processo e container próprios desde o início**, no mesmo repositório e com a mesma imagem do backend, com outro ponto de entrada (`node dist/whatsapp-connector.js`) — terceiro tipo de serviço, ao lado de `api` e `worker`.
- **Tratado como um serviço à parte**, para que a extração futura seja mover a pasta:
  - comunica-se com o resto **somente por filas/eventos no Redis** (BullMQ); não importa código de outros módulos;
  - é dono das **próprias tabelas** (estado de autenticação), em schema próprio;
  - fronteiras garantidas pelo lint.
- **Posse das conexões:** cada número pertence a exatamente uma instância, por lease no Redis com renovação periódica; se a instância cair, outra assume ao expirar o lease.
- **Estado de autenticação** (credenciais e chaves de sessão) persistido **no Postgres, criptografado** — nunca em arquivo (containers são descartáveis).
- **Pareamento:** o QR code é enviado ao frontend em tempo real.
- **Envio:** comandos de envio são roteados para a fila da instância dona do número.

## Alternativas consideradas

- **Baileys dentro do processo da API** — rejeitado: cada deploy/restart da API derrubaria todas as conexões, e a API deixaria de ser stateless.
- **Microsserviço completo desde já** (repositório, banco e pipeline próprios) — rejeitado por ora: custo de dois pipelines, contrato versionado e infraestrutura duplicada, sem ganho para ~10 clientes. Gatilhos para extrair: centenas de números, conflito de dependências do Baileys, time dedicado a canais, necessidade de outro runtime.
- **Somente provedores terceiros (BSPs como Twilio, 360dialog, Gupshup)** — não atende ao canal não oficial; podem entrar depois como mais um adapter.

## Consequências

- O Swarm passa a ter três serviços da mesma imagem: `api`, `worker` e `whatsapp-connector`. O conector pode ser atualizado sozinho (outra tag), sem tocar nos demais.
- Um deploy do conector causa uma reconexão breve dos números; mensagens recebidas nesse intervalo são entregues pelo WhatsApp ao reconectar.
- É preciso monitorar o estado das conexões (conectado, aguardando QR, desconectado, banido) e avisar o cliente no painel.
- **Risco aceito:** o uso do Baileys viola os termos do WhatsApp e pode levar ao banimento de números. O canal é identificado como "não oficial" para os clientes; testes usam números secundários.
- Atualizações do Baileys devem ser acompanhadas de perto (mudanças de protocolo do WhatsApp quebram versões antigas).

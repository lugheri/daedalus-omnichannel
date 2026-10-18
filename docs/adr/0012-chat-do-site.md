# 0012 — Chat do site e canais com tipo

- **Status:** Aceito
- **Data:** 2026-10-17

## Contexto

O atendimento multicanal precisa de um chat no site da conta (o site do
módulo de sites, ADR 0010, ou um site de fora). Até aqui o único canal era o
WhatsApp (ADR 0006), e tudo em canais e conversas presumia telefone: a
mensagem sem telefone era descartada, a resposta ia sempre para
`contact.phone`, e o tempo real só aceitava quem está logado no painel.

Decisões de produto: o visitante se identifica antes de conversar (nome +
WhatsApp ou e-mail, vira lead), o chat fica sempre aberto (sem horário), e o
e-mail na caixa de entrada fica para depois da escolha do provedor de e-mail.

## Decisão

- **Canal com tipo.** `Channel.provider` passa a ser `whatsapp_baileys` ou
  `web_chat`. O chat do site não tem sessão nem QR: nasce ligado
  (`connected`); desligar (`disconnected`) tira o widget dos sites. Tem uma
  chave pública (vai no HTML do site; trocar desliga o código antigo) e as
  configurações do widget (título, saudação, cor).
- **Mesmo caminho do WhatsApp para dentro.** A mensagem do visitante vira o
  mesmo `channel.message.received.v1`, com um campo novo, `contactId` (o
  contato que o canal já identificou). Conversations grava pela fila,
  idempotente pelo id que o widget gera para cada mensagem.
- **Resposta pelo endereço do canal.** Conversations pergunta "para quem vai"
  ao canal da conversa (`ConversationRecipient`): telefone no WhatsApp; o
  próprio contato no chat do site. Para o chat, "enviar" é avisar o widget do
  visitante na hora e dar a mensagem por enviada (o resultado vem pelo mesmo
  evento de sempre). Só texto, por enquanto (sem anexos nos dois sentidos).
- **Módulo `webchat`, o lado público:** o script do widget (JS sem
  dependências, servido pela API), a configuração pela chave, a identificação
  do visitante (contato pela regra da captura de leads, origem `web_chat`) e
  as mensagens dele. Só na API.
- **Token do visitante, sem estado.** HMAC (chave derivada do JWT_SECRET com
  rótulo próprio) com canal, conta, contato, nome e o começo da sessão;
  validade de 30 dias; guardado no `localStorage` do site e enviado no
  `Authorization` — nunca em cookie, o site é de outro domínio.
- **O visitante só lê a própria sessão.** O histórico começa no início da
  sessão: quem digita o telefone de outra pessoa não lê a conversa anterior
  dela (vê só o que for dito dali em diante).
- **Tempo real do visitante:** namespace Socket.IO próprio (`/chat`), com o
  token do visitante, só WebSocket (o navegador não aplica CORS a WebSocket) e
  só sinal ("chegou mensagem"); o widget busca as mensagens pela API. O
  cliente Socket.IO é o que o próprio servidor serve
  (`/socket.io/socket.io.min.js`) — sem CDN. Sem WebSocket, o widget consulta a
  cada 5 s com o painel aberto.
- **CORS por rota:** só `/v1/public/chat/*` aceita qualquer origem, sem
  credenciais; o resto da API continua só com as origens do painel.
- **Site:** o conteúdo do site ganha `chatChannelId`; ao gerar o HTML, o
  compositor põe o `<script>` do widget antes do `</body>` (na prévia, em modo
  prévia, que não identifica nem envia). Qualquer modelo ganha o chat sem
  mudar; `{{#chat.enabled}}` deixa o modelo abrir espaço para o botão.

## Alternativas consideradas

- **Chat de terceiros (Tawk, Crisp, JivoChat):** conversas fora da caixa de
  entrada e do CRM; o que se quer é um atendimento só.
- **Visitante anônimo:** menos atrito, mas a conversa se perde quando a pessoa
  sai, e o CRM fica com "visitantes" sem dado. Descartado por decisão de
  produto.
- **Sessão do visitante no servidor (Redis/Postgres):** daria para revogar,
  mas é estado a mais para algo que o token resolve; trocar a chave do widget
  ou desligar o chat já corta o uso.
- **SSE ou long-polling próprios para o visitante:** exigiriam pub/sub
  próprio entre réplicas; o Socket.IO com o adapter Redis já entrega de
  qualquer processo, inclusive do worker.
- **iframe com o widget servido pelo painel:** isola mais, mas exige outra
  origem de cookie/armazenamento e piora o carregamento; o Shadow DOM isola o
  CSS, e o widget não tem acesso a nada além do próprio token.

## Consequências

- Um visitante com o mesmo telefone/e-mail de um contato existente cai nesse
  contato (como no formulário do site): o atendente vê o histórico dele nos
  outros canais.
- A conversa do chat do site é uma por (canal, contato), como no WhatsApp:
  sessões novas do mesmo contato continuam a mesma conversa na caixa de
  entrada.
- Anexos, "digitando…", avaliação do atendimento e horário de atendimento
  ficam para depois.
- O e-mail entra na caixa de entrada depois da escolha do provedor (passo 7):
  o caminho é o mesmo (`kind` do canal + `ConversationRecipient`).

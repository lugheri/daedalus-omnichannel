# 0009 — Hierarquia de contas (conta-mãe, revendedores e acesso delegado)

- **Status:** Aceito
- **Data:** 2026-10-17

## Contexto

O produto é vendido a pequenos negócios, e quem monta e cuida da conta do
cliente muitas vezes não é o próprio cliente: é a Daedalus (a plataforma) ou um
parceiro que revende e atende a carteira dele. Essas pessoas precisam:

- criar a conta do cliente e convidar o dono;
- entrar na conta para configurar (site, funis, canais) e dar suporte;
- ver todas as contas que gerenciam — inclusive as dos clientes de um revendedor
  que está abaixo delas.

Até aqui cada conta (tenant) era solta (ADR 0002), e o único jeito de "entrar"
numa conta era ser membro dela (ADR 0003). Convidar a equipe da plataforma como
membro de cada cliente polui a lista de membros, exige um convite por pessoa e
por conta e não some quando a pessoa sai da plataforma.

O cliente, por sua vez, precisa saber quem gerencia a conta dele e quem de lá
entrou.

## Decisão

- **Árvore de contas com profundidade livre.** `Tenant.parentId` aponta para a
  conta-mãe e `Tenant.ancestors` guarda o caminho da raiz até a mãe (`uuid[]`
  com índice GIN): "todas as contas abaixo de X" é `X = ANY(ancestors)`, sem
  recursão. Uma conta nunca muda de mãe pelo produto (o caminho é gravado na
  criação).
- **Uma conta raiz** (`isRoot`), a da plataforma, marcada uma única vez pelo
  comando `node dist/designate-root.js <slug>`, que também pendura nela as
  contas que ainda não têm mãe. **Cadastro público nasce abaixo da raiz.**
- **Revendedor é uma marca da conta** (`allowsChildren`), decidida por quem
  está acima: só a raiz e as contas marcadas criam contas abaixo. A permissão
  `accounts:children` (Owner e Admin por padrão) diz **quem** na conta pode
  gerenciar as contas abaixo; a marca diz **se** a conta pode ter contas abaixo.
  Sem a marca, todo Admin de cliente poderia abrir contas à vontade.
- **Quem está acima enxerga a subárvore inteira** (filhas, netas...) e pode
  criar, suspender, reativar e marcar/desmarcar revendedor. Conta suspensa: ninguém
  entra, nem de cima.
- **Entrar numa conta abaixo é acesso delegado, registrado.** A troca de conta
  normal (`POST /v1/auth/switch-account`) cria, na conta de destino, um vínculo
  `Membership` com `delegatedFromMembershipId` = o vínculo de origem e o cargo
  de sistema `parent_access` ("Acesso da conta-mãe"): permissões de Admin,
  **menos `account:manage`** (faturamento, dados e exclusão ficam com o dono).
  Cada entrada grava um `ParentAccess` (quem, de qual conta, quando).
- **O acesso delegado vale só enquanto a origem vale**, conferido a cada
  resolução de acesso (cache de 60 s): o vínculo de origem precisa estar ativo,
  não ser delegado, ser da mesma pessoa, estar numa conta **acima** da de
  destino, não suspensa, e ter `accounts:children`. Desligar a pessoa lá em
  cima derruba o acesso em todas as contas abaixo — sem varrer nada.
- **Transparência para o cliente:** a conta vê o nome da conta-mãe e o
  histórico de acessos (em Membros). O visitante **não aparece** na lista de
  membros nem conta como membro; o cargo `parent_access` não aparece nos cargos
  e não pode ser atribuído. Ele aparece no diretório de nomes (é quem assina o
  que fizer lá dentro).
- **Os dados continuam por conta** (ADR 0002): a hierarquia controla só quem
  entra. Nenhuma consulta de negócio cruza contas.

## Alternativas consideradas

- **Convidar a equipe da plataforma como membro de cada conta.** Simples, mas
  polui a lista de membros, depende de convite por pessoa e por conta e deixa
  acesso para trás quando a pessoa sai. Descartada.
- **"Personificar" o dono (entrar como ele).** Apaga a autoria (tudo parece
  feito pelo cliente) e dá acesso de dono. Descartada: o acesso precisa ser de
  quem entrou, registrado e menor que o do dono.
- **Árvore por `parentId` com consulta recursiva (CTE).** Funciona, mas toda
  checagem de "está abaixo de" vira recursão; o caminho materializado
  (`ancestors`) resolve com um índice. Como a conta não troca de mãe, o custo de
  manter o caminho é zero.
- **Permissões da plataforma (`platformRole`) para entrar em qualquer conta.**
  Resolve só a Daedalus, não os revendedores. O `platformRole` continua
  separado, para administração da plataforma.

## Consequências

- Uma pessoa da conta-mãe ganha um vínculo delegado em cada conta em que entra;
  o vínculo é reaproveitado nas entradas seguintes (a origem é atualizada se
  mudar).
- Tirar `accounts:children` do cargo de alguém, desativá-lo ou suspender a
  conta-mãe corta os acessos delegados em até 60 s (cache de acesso).
- Mover uma conta de galho (trocar de revendedor) não existe no produto: exigiria
  regravar `ancestors` de toda a subárvore e decidir o que acontece com os
  acessos delegados. Fica para quando houver o caso.
- Limites de plano por revendedor (quantas contas pode criar) são
  *entitlements*, para o passo de planos.
- Depois do primeiro deploy, o comando `designate-root` precisa ser rodado uma
  vez (`docs/deploy.md`).

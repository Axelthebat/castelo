# Decisões registradas

Anotações das escolhas que fogem do contrato original ou que resolveram uma ambiguidade durante a
construção.

## Engine

**Implementação modular em vez de arquivo único.** O contrato previa um `packages/engine` com a API
pública descrita; a implementação foi dividida em `position.ts`, `clock.ts`, `rating.ts`, `pgn.ts`,
`bot.ts` e `fen.ts`, com `index.ts` reexportando. Motivo: o bot e a posição evoluem em ritmos
diferentes, e o relógio é usado isoladamente pelo servidor.

**`chess.js` como única fonte das regras.** Nada de implementação própria de geração de lances.
O wrapper `Position` traduz o `Move` do chess.js para o `MoveInfo` do contrato e revalida o lance
antes de aplicá-lo.

**Bot com negamax, não com Stockfish.** Não há binário externo no ambiente, e a exigência era um bot
real. O motor usa negamax iterativo com poda alfa-beta, quiescência, tabelas de material e posição
por casa, bônus de par de bispos, penalidade de peão dobrado e ordenação MVV-LVA. O tempo de
cálculo é limitado por orçamento de tempo checado dentro do laço de busca.

**Níveis baixos jogam de propósito.** `blunderRate` faz o bot escolher um lance fraco com uma
probabilidade definida por nível. Isso dá aos níveis aprendiz e casual o comportamento de alguém
que está aprendendo, em vez de um motor forte com peças aleatórias.

**`eloUpdate` usa K variável.** K = 40 abaixo de 2100, 20 até 2400 e 10 acima disso, em vez do K
fixo de 32 que a primeira implementação do servidor usava. O servidor passou a usar a função do
engine, e `lib/elo.ts` ficou só com o cálculo de pontuação por resultado.

## Servidor

**`node:sqlite` no lugar de um ORM.** Node 26 traz o módulo nativo; ele evita dependência de
binários externos e de etapa de geração de código. O custo é reescrever um diretório caso o
projeto mude para Postgres — o isolamento em `repos/` foi feito com essa intenção.

**Token de sessão cru fora da resposta da API.** O contrato previa devolver `{ user, token }` no
cadastro e no login. O token cru da sessão não é mais devolvido no corpo da resposta: ele existe
apenas no cookie `HttpOnly`. A resposta entrega o `csrfToken`, que é o valor que o cliente precisa
usar de fato.

**E-mail fora do perfil público.** `PublicUser` não carrega e-mail. As respostas de `/api/auth/me`,
`/api/auth/login` e `/api/auth/register` usam `CurrentUser`, que estende `PublicUser` com o e-mail.
O endpoint de perfil público nunca devolve o campo.

**`requireCsrf` com dois parâmetros.** A primeira versão aceitava um terceiro argumento opcional
(`db`). Como o Fastify trata hooks com três parâmetros como callbacks, ele passava a função
`done` no lugar do `DatabaseSync` e toda requisição mutativa quebrava. O guard usa agora
`getSession(req)` e a aridade correta.

**Assinatura da partida pelo WebSocket.** O cliente envia `game:subscribe` ao abrir a tela de
partida. Só participantes assinam; o estado e o chat são privados da partida. Sem isso, uma partida
criada por REST (contra o bot) nunca entregava eventos ao jogador.

**Estado da partida resolvido por `getSession(req)` na rota, não por `preHandler`.**
`GET /api/games/:id` serve participante e espectador. Exigir `requireAuth` na rota transformaria
espectadores em erro 401; resolver a sessão dentro do handler devolve a visão completa para quem
joga e a visão reduzida para quem só assiste.

## Interface

**Sem biblioteca de iconografia.** Todos os ícones são SVG inline em `components/icons.tsx`,
desenhados para o projeto. Emoji foi descartado por orientação de design e por renderização
inconsistente entre plataformas.

**Peças em SVG original.** O conjunto `packages/web/src/components/pieces` foi desenhado do zero,
com traço e geometria consistentes, em vez de reaproveitar um conjunto de terceiros.

**Fonte empacotada.** Space Grotesk vem de `@fontsource-variable/space-grotesk`, instalada pelo
npm, em vez do CDN do Google Fonts. Isso remove uma requisição a terceiros, funciona offline e
mantém a CSP em `font-src 'self'`.

**Item "Estudos" removido da navegação.** A página de lições não existe ainda, e apontar o menu
para uma rota inexistente seria pior do que não oferecer a opção. O item volta junto com o
conteúdo, sem dados fictícios no lugar.

## Tabuleiro

**Classe de cor das peças.** A cor no tabuleiro é `w`/`b` (como no FEN), mas o CSS define
`.piece-white` e `.piece-black`. O componente `Piece` traduz `w`/`b` para esses nomes: o CSS não
depende do formato do FEN e o `Piece` nunca emite uma classe que não exista na folha de estilo.

**Marcadores de lance legal em escuro com aro claro.** A primeira versão usava ivory a 42% de
opacidade — praticamente invisível sobre as casas claras do tabuleiro. Agora o marcador é
`rgb(26 20 13 / 0.58)` com aro branco, o que lê tanto nas casas claras quanto nas escuras. A casa
selecionada ganhou contorno de acento e o hover usa tinta escura nas casas claras e clara nas
escuras.

**Abertura do quadro de demonstração.** A sequência inicial era montada com `split('')`, que
quebrava `e2e4` em caracteres e fazia o botão "Abertura" falhar silenciosamente. Passou a fatiar a
casa por posição, com a abertura italiana verificada lance a lance e fallback para a posição
inicial caso a sequência deixe de ser legal.

## Processamento de texto

O texto visível do site foi reescrito com a skill de escrita profissional: removidas formulações
inflacionadas,enchimento e hedge; frases encurtadas; headlines limitadas a duas linhas; e
afirmações corrigidas para bater com o que o código faz (por exemplo, partidas contra o bot entram
no histórico, mas não alteram o rating).

## Agentes de sub-tarefa

Três subagentes foram acionados em paralelo para motor, servidor e interface. Os três atingiram o
limite de uso do modelo antes de concluir. O motor foi reimplementado e validado por completo
(17 testes); o servidor e a interface foram finalizados manualmente sobre o que os agentes já
tinham escrito. O rascunho de 1.544 linhas do motor produzido pelo subagente foi mantido em
`/tmp` para comparação e não foi adotado, por não estar coberto por testes.

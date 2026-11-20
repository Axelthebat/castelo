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
real. O motor usa negamax iterativo com Principal Variation Search, tabela de transposição,
killer moves, histórico, redução de lance tardio, extensão de xeque, corte de futility e
quiescência com ordenação MVV-LVA. A avaliação soma material, posição por casa, par de bispos,
estrutura de peões (dobrado, isolado, passado), torre em coluna aberta, escudo do rei e o direito
de initiative.

**Tabuleiro próprio para a busca.** O chess.js continua sendo a referência de regras do projeto,
mas `chess.moves({ verbose: true })` custa cerca de 856µs porque cada lance gera dois FEN — um
gargalo que limitava a busca à profundidade 4. O motor usa um tabuleiro interno de 64 casas com
make/unmake e gerador de lances próprios, o que elevateou a busca para ~1 milhão de nós em 3
segundos. A correção do gerador é provada por `perft`: as contagens de lances batem com o chess.js
em seis posições de referência (inicial, Kiwipete, final de peões, promoções e mais duas) até a
profundidade 4.

**Níveis medidos por margem de erro, não por lance aleatório.** Cada nível tem uma profundidade, um
orçamento de tempo e uma margem (`noise`) em centipontos. O bot joga o melhor lance foundo, mas
com probabilidade `blunderRate` escolhe entre os lances dentro da margem. O resultado é um erro
humano: o aprendiz abre com 1.b4 e ignora material, mas não pendura a rainha. A margem impede que o
nível iniciante perca peça de graça; o mestre joga sempre o melhor lance.

**Tempo por lance x. tempo de espera.** O serviço do bot espera de 350ms a 900ms antes de responder,
para não parecer instantâneo. Os orçamentos de busca (200ms a 2s) são somados a essa espera.

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

**Página "Estudos".** Voltou à navegação com quatro aberturas reais (Italiana, Siciliana,
Gambito da Dama e Caro-Kann). Cada sequência foi validada lance a lance com chess.js antes de
entrar no código, e as posições exibidas são geradas pelo engine. Não há conteúdo fictício.

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

## Problemas de xadrez

**Catálogo real no banco, não dados fixos no cliente.** A tabela `puzzles` guarda 12 posições com
solução em UCI. Todas as sequências foram geradas e conferidas com `chess.js`: cada uma termina em
xeque-mate e todos os lances são legais na posição. O seed é idempotente.

**O servidor decide se o problema foi resolvido.** O cliente envia só as jogadas (`moves` em UCI);
`checkPuzzleSolution()` compara com a solução gravada e `computePuzzleRating()` aplica o rating.
Antes, a rota aceitava `solved` do cliente — o que permitiria forçar um acerto.

## Análise e convites

**Replay fora do painel estreito.** A primeira versão colocava o replay dentro do painel de 20rem
da partida e as duas colunas se sobrepunham. Partidas encerradas agora ocupam a largura da página,
com navegação por setas do teclado e PGN copiável.

**Convites aceitos viram partida real.** `POST /api/challenges/:id/accept` cria a partida no runtime
com o controle de tempo do convite e devolve o `gameId`; a interface navega para ela. Recusar marca o
convite como `declined`.

**IDs de partida não são só UUID.** As partidas do seed usam slugs (`seed-game-scholar`). A validação
de parâmetros aceita `[a-zA-Z0-9_-]`, e erros de Zod dentro dos handlers passaram a responder 400 em
vez de 500.

## Interface

**Movimento com transform e opacity.** Entrada de página, pressão de botão, deslizamento de peças e
atualização das anotações das lições. `prefers-reduced-motion` desliga os deslocamentos.

**Som sintetizado.** Web Audio gera os tons de lance, captura, xeque, fim e lance inválido. Nenhum
arquivo de áudio entra no repositório, e o volume respeita a configuração salva.

**Diagrama SVG da arquitetura.** `docs/assets/arquitetura.svg` segue as convenções da skill
svg-diagram (espaçamento mínimo de 25px, setas com `markerUnits`, posteriores em primeiro lugar,
fonte CJK declarada). Validado com `svg-lint`: 0 erros e 0 avisos.

**Estudos com linhas verificadas.** As quatro aberturas foram checadas lance a lance com chess.js
antes de entrar no código; as posições exibidas vêm do engine, não de FEN copiado.

## Direção de cor (Color Art Direction)

**Arquivo de Xadrez.** Biblioteca consultada: `references/palette-library.json` da skill. Comparei
Museum Archive, Mapping the Unseen e Graphite Copper; escolhi Museum Archive combinada com Mapping
the Unseen porque o produto já é um arquivo de partidas históricas e aberturas clássicas. O tema
claro usa pergaminho `#E9E0CC`, marinho `#142B4A` nas ações e ouro antigo `#A68A5C` apenas no glifo
e em detalhes. O ouro puro dá 2,50:1 sobre pergaminho — por isso a variante `#7A5F30` para texto.

**Arquivo Noturno.** Mesma linguagem invertida: verde-charcoal profundo `#171A18`, latão `#D4B276`
nas ações (o marinho perdia contraste no escuro), tinta `#EFE8D8`. Contrastes medidos antes de
aplicar: texto principal 14,37:1 no fundo, ações 8,56:1 sobre o latão, estados todos acima de
4,5:1 nas superfícies.

**Alternador sem flash.** O `data-theme` é escrito por um script inline no `index.html` antes do
primeiro paint, lendo `localStorage` ou `prefers-color-scheme`. O `ThemeProvider` mantém o estado,
atualiza o `theme-color` da barra do navegador e acompanha mudanças do sistema enquanto não houver
escolha manual.

**Correções de contraste.** O antigo `--color-ink-faint` (#6E6558) reprovava AA no tema escuro
(2,96:1). No tema claro o valor é `#655C50` e no escuro `#9A907E`. O vermelho de perigo também foi
substituído por `#7B302E` (claro) e `#DB8878` (escuro), ambos acima de 4,5:1.

**Validação visual.** Playwright em 1440, 768 e 390px, nos dois temas, em 7 rotas: 42 combinações
sem overflow e com o tema aplicado. Capturas em `docs/img/tema-claro.png` e `tema-escuro.png`.

## Refinamento UI/UX

**ui-ux-pro-max** (buscas em `ux` e `icons`): confirmei 4,5:1 mínimo, nomes acessíveis em botões de
ícone e indicador de foco de 2px. Os botões de tema usam `aria-label`, `aria-pressed` nas opções de
Configurações e mantêm o foco visível.

**taste-skill**: o lint encontrou 25 falhas. Corrigi as reais — troquei `font-mono` de notações por
fonte de display com algarismos tabulares, removi o rótulo minúsculo em caixa alta, converti
`box-shadow` de contorno em `outline` e eliminei bordas redundantes onde o passo de tom já separa.
As 13 linhas restantes são separadores de tabelas de dados (lances, ranking, amigos, histórico),
permitidos pela própria skill e marcados com `taste-skill-ignore`. Resultado final: **0 falhas, 3
avisos justificados** (zero-padding do relógio, borda de 1px do anel de captura e travessões no
texto).

**playwright-cli** não está disponível neste ambiente (nem global, nem via `npx`). A validação de
navegador foi feita com o MCP Playwright, que estava conectado.

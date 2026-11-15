# Contrato técnico — Castelo

Contrato único para os três workstreams (engine / servidor / web). **Todos os agentes devem ler este
arquivo antes de escrever código.** Se algo estiver ambíguo, escolha a opção mais simples que
satisfaça o contrato e registre a decisão em `docs/DECISOES.md`.

---

## 1. Monorepo

```
castelo/
├─ packages/shared   @castelo/shared  — tipos + schemas zod (JÁ PRONTO)
├─ packages/engine   @castelo/engine  — regras, relógio, rating, PGN, bot
├─ apps/server       @castelo/server  — Fastify + node:sqlite + ws
└─ apps/web          @castelo/web     — React 19 + Vite + Tailwind v4
```

- Node >= 22. TypeScript ESM (`"type": "module"`).
- Imports entre pacotes usam o alias do workspace: `import { x } from '@castelo/engine'`.
- O `exports` de cada pacote aponta para `src/index.ts` (dev) — o build gera `dist/`.
- Não criar novos pacotes. Não introduzir ORM, framework de UI ou biblioteca de xadrez além de
  `chess.js` (já instalado).

---

## 2. `@castelo/engine` — API pública (autoritativa)

O engine é **puro e síncrono**. Não importa nada de `node:*`, nem do `@castelo/shared`, nem faz I/O.
Ele é usado **tanto pelo servidor (autoridade) quanto pelo cliente (pré-visualização)**.

```ts
export type Color = 'w' | 'b';
export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export interface MoveInfo {
  san: string;              // "Nf3", "exd5", "O-O", "e8=Q+"
  from: string;             // "e2"
  to: string;               // "e4"
  promotion?: 'q' | 'r' | 'b' | 'n';
  piece: PieceType;
  captured?: PieceType;
  isCapture: boolean;
  isEnPassant: boolean;
  isCastling: boolean;
  isPromotion: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  fenBefore: string;
  fenAfter: string;
}

export interface GameEnd {
  over: boolean;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  reason:
    | 'checkmate' | 'stalemate' | 'insufficient-material'
    | 'threefold-repetition' | 'fifty-move-rule' | 'resignation'
    | 'timeout' | 'draw-agreement' | 'abandoned';
  /** texto curto para a UI, ex.: "Xeque-mate", "Empate por material insuficiente" */
  description: string;
}

/** Uma posição isolada — o "estado do tabuleiro". */
export class Position {
  constructor(fen?: string);                 // sem fen => posição inicial
  fen(): string;
  turn(): Color;
  board(): (PieceType | null)[][];          // board[rank][file], rank 8 primeiro (linha 0 = rank 8)
  get(square: string): { type: PieceType; color: Color } | null;
  legalMoves(): MoveInfo[];                 // todos os lances legais
  legalMovesFrom(square: string): MoveInfo[];
  isLegal(from: string, to: string, promotion?: string): boolean;
  /** Aplica o lance. Lança `IllegalMoveError` se o lance for ilegal. */
  move(from: string, to: string, promotion?: string): MoveInfo;
  moveSan(san: string): MoveInfo;
  undo(): MoveInfo | null;
  moves(): string[];                        // SANs do histórico
  history(): MoveInfo[];
  inCheck(): boolean;
  gameEnd(): GameEnd;                       // over=false se a partida continua
  pgn(headers?: Record<string, string>): string;
  loadPgn(pgn: string): void;
  /** clone() deve devolver uma posição independente */
  clone(): Position;
}

export class IllegalMoveError extends Error {
  constructor(message: string, readonly code: 'illegal' | 'game-over' | 'bad-input');
}

/* ---------------- Relógio ---------------- */
export interface ClockConfig { baseMs: number; incrementMs: number; }

export class Clock {
  constructor(config: ClockConfig);
  readonly config: ClockConfig;
  /** tempo restante do jogador que está na jogada, em ms */
  remaining(color: Color): number;
  /**按下 */
  press(color: Color, nowMs: number): number;
  /** tempo restante no instante `nowMs` para ambos os lados */
  snapshot(nowMs: number): { w: number; b: number; active: Color | null; running: boolean };
  /** devolve o incremento para o jogador que acabou de mover */
  applyIncrement(color: Color): number;
  expired(color: Color, nowMs: number): boolean;
}

/* ---------------- Rating (Elo) ---------------- */
export interface EloResult { white: number; black: number; expectedWhite: number; }
export function eloUpdate(
  whiteRating: number, blackRating: number,
  result: '1-0' | '0-1' | '1/2-1/2',
  kFactor?: number,
): EloResult;

/* ---------------- PGN ---------------- */
export interface PgnHeaders {
  Event?: string; Site?: string; Date?: string; Round?: string;
  White?: string; Black?: string; WhiteElo?: number; BlackElo?: number;
  Result?: string; TimeControl?: string; Termination?: string; [k: string]: string | number | undefined;
}
export function toPgn(position: Position, headers: PgnHeaders): string;
/** Lê PGN e devolve { headers, position }. Lança `PgnParseError`. */
export function parsePgn(pgn: string): { headers: PgnHeaders; position: Position };
export class PgnParseError extends Error {}

/* ---------------- Bot ---------------- */
export type BotDifficulty = 'beginner' | 'casual' | 'strong' | 'master';
export interface BotOptions {
  difficulty: BotDifficulty;
  /** tempo máximo de cálculo por lance, em ms */
  timeBudgetMs?: number;
  /** semente para repetibilidade (tests) */
  seed?: number;
}
export interface BotMoveResult { from: string; to: string; promotion?: string; san: string; score: number; }
export function botMove(position: Position, options: BotOptions): BotMoveResult;
export const BOT_PROFILES: Record<BotDifficulty, { label: string; description: string; depth: number; timeBudgetMs: number; blunderRate: number; }>;

/* ---------------- FEN ---------------- */
export const START_FEN: string;
export function isValidFen(fen: string): boolean;
export function describeFen(fen: string): { turn: Color; inCheck: boolean; legalMoveCount: number };
```

### Regras do engine
- Toda a lógica de lance legal vem do `chess.js` (v1.4, já instalado). Não reimplementar regras.
- O engine **nunca** confia no cliente: `Position.move()` revalida o lance contra a posição atual.
- `gameEnd()` deve cobrir: xeque-mate, stalemate, material insuficiente, repetição tripla, regra dos 50
  lances. Para empate por acordo/desistência/timeout, o servidor passa o motivo.
- `board()` deve devolver `[rank 8][file a]` primeiro (igual notação do xadrez).

---

## 3. Banco de dados — `node:sqlite` (API `DatabaseSync`)

Arquivo: `apps/server/data/castelo.db` (criado no boot se não existir). PRAGMA `journal_mode=WAL`,
`foreign_keys=ON`.

### Tabelas

```sql
users(
  id TEXT PRIMARY KEY,             -- uuid v4
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  country TEXT, title TEXT, bio TEXT, location TEXT, favourite_piece TEXT,
  rating_bullet INTEGER NOT NULL DEFAULT 1200,
  rating_blitz  INTEGER NOT NULL DEFAULT 1200,
  rating_rapid  INTEGER NOT NULL DEFAULT 1200,
  rating_classical INTEGER NOT NULL DEFAULT 1200,
  peak_rating INTEGER NOT NULL DEFAULT 1200,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

sessions(
  id TEXT PRIMARY KEY,              -- sha256 do token (nunca o token bruto)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  user_agent TEXT, ip TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
)

password_resets(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
)

games(
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,               -- 'online' | 'bot' | 'puzzle'
  status TEXT NOT NULL,             -- 'waiting' | 'active' | 'finished'
  time_control TEXT NOT NULL,       -- "10+5"
  rated INTEGER NOT NULL DEFAULT 1,
  white_id TEXT REFERENCES users(id),
  black_id TEXT REFERENCES users(id),
  bot_difficulty TEXT,
  fen TEXT NOT NULL,
  pgn TEXT,
  result TEXT,                      -- '1-0' | '0-1' | '1/2-1/2'
  termination TEXT,
  moves TEXT NOT NULL DEFAULT '[]', -- JSON array de {san,from,to,promotion,fen,ms}
  clock_white INTEGER, clock_black INTEGER,
  clock_started_at INTEGER,
  created_at TEXT NOT NULL,
  ended_at TEXT
)

game_chat(id TEXT PRIMARY KEY, game_id TEXT REFERENCES games(id) ON DELETE CASCADE, user_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)

puzzle_attempts(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, puzzle_id TEXT NOT NULL, solved INTEGER NOT NULL, moves TEXT NOT NULL, rating_before INTEGER, rating_after INTEGER, created_at TEXT NOT NULL)

friendships(id TEXT PRIMARY KEY, requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(requester_id, addressee_id))

friends_challenges(id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, time_control TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)

user_settings(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, board_theme TEXT NOT NULL DEFAULT 'walnut', piece_theme TEXT NOT NULL DEFAULT 'castelo', show_coordinates INTEGER NOT NULL DEFAULT 1, show_legal_moves INTEGER NOT NULL DEFAULT 1, animate_moves INTEGER NOT NULL DEFAULT 1, sound_enabled INTEGER NOT NULL DEFAULT 1, sound_volume INTEGER NOT NULL DEFAULT 60, default_time_control TEXT NOT NULL DEFAULT '10+5', board_orientation TEXT NOT NULL DEFAULT 'auto')
```

### Onde fica cada módulo (apps/server/src)

```
apps/server/src/
├─ index.ts             boot: fastify + ws + rotas
├─ env.ts               leitura/validação de process.env (zod)
├─ db/
│  ├─ index.ts          abre o DatabaseSync, aplica schema (CREATE TABLE IF NOT EXISTS), expõe db
│  ├─ schema.sql        DDL acima
│  ├─ migrate.ts        aplica schema.sql (idempotente) + seed opcional
│  └─ seed.ts           cria dados de DESENVOLVIMENTO (usuários demo) — executado por `npm run seed`
├─ lib/
│  ├─ password.ts       hash/verify com node:crypto scrypt (N=2^15,r=8,p=1,64B) + salt aleatório
│  ├─ session.ts        criar/validar/encerrar sessão; token aleatório 32B base64url; guarda sha256
│  ├─ csrf.ts           double-submit token
│  ├─ ids.ts            uuid v4 via node:crypto randomUUID
│  ├─ time.ts           helpers de data ISO
│  └─ errors.ts         HttpError { status, code, message }
├─ repos/               funções de acesso ao banco (users, games, friends, puzzles, ratings)
├─ routes/
│  ├─ auth.ts           register, login, logout, me, forgot, reset
│  ├─ users.ts          perfil público, configurações, estatísticas
│  ├─ games.ts          listar partidas, obter partida, PGN, criar contra bot, 등등
│  ├─ social.ts         amigos, desafios
│  └─ misc.ts           leaderboard, puzzles
└─ realtime/
   ├─ hub.ts            WebSocketServer, mapa socket->user, salas de partida
   └─ game-service.ts   estado de partida em memória + persistência + relógio autoritativo
```

---

## 4. API HTTP (prefixo `/api`)

Respostas de erro: `{ "error": { "code": "...", "message": "...", "fields": {...} } }` (ver `ApiError`
em `@castelo/shared`).

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/register` | — | cria usuário, faz login, devolve `{ user, token }` |
| POST | `/api/auth/login` | — | login por username **ou** e-mail |
| POST | `/api/auth/logout` | sim | encerra a sessão atual |
| GET  | `/api/auth/me` | sim | usuário da sessão |
| POST | `/api/auth/forgot` | — | envia link de reset (sempre 200, não revela se o e-mail existe) |
| POST | `/api/auth/reset` | — | consome o token e troca a senha |
| GET  | `/api/users/:username` | — | perfil público + stats |
| PATCH| `/api/users/me` | sim | atualiza bio/local/país |
| GET  | `/api/users/me/settings` | sim | settings |
| PATCH| `/api/users/me/settings` | sim | atualiza settings |
| GET  | `/api/users/:username/games` | — | histórico paginado |
| GET  | `/api/users/me/stats` | sim | estatísticas agregadas |
| GET  | `/api/games/:id` | opcional | estado da partida (só participantes veem o completo) |
| GET  | `/api/games/:id/pgn` | opcional | PGN |
| POST | `/api/games/bot` | sim | cria partida contra o bot (retorna id; o jogo é conduzido por REST + WS) |
| POST | `/api/games/:id/move` | sim | **fallback REST** para mover (o WS é o canal principal) |
| POST | `/api/games/:id/resign` | sim | desistir |
| GET  | `/api/leaderboard?category=blitz&page=1` | — | ranking |
| GET  | `/api/puzzles/next?rating=1200` | sim | próximo problema |
| POST | `/api/puzzles/:id/attempt` | sim | registra tentativa e devolve rating novo |
| GET  | `/api/puzzles/rating` | sim | rating de problemas |
| GET  | `/api/friends` | sim | lista de amigos + pedidos |
| POST | `/api/friends/request` | sim | `{ username }` |
| POST | `/api/friends/:id/accept` | sim | aceita pedido |
| DELETE | `/api/friends/:id` | sim | remove amigo / cancela pedido |
| POST | `/api/challenges` | sim | `{ username, timeControl }` |

Autenticação: cookie `castelo_session` (`HttpOnly`, `SameSite=Lax`, `Secure` em produção, `__Host-`
quando `NODE_ENV=production`). Header `X-CSRF-Token` obrigatório em métodos mutativos — o valor é
entregue no login/registro e no `GET /api/auth/me`, e salvo na sessão.

Rate limiting (por IP, via `@fastify/rate-limit`):
- `auth:*` → 10 req / 5 min
- `POST /api/games/:id/move` → 120 req / min
- resto da API → 300 req / min

---

## 5. WebSocket

- Endpoint: `/ws`. Upgrade autenticado pelo cookie de sessão (mesma validação do HTTP).
- Se não autenticado → fechar com código 4401.
- Mensagens cliente/servidor: exatamente os tipos `ClientMessage` / `ServerMessage` de
  `@castelo/shared`.
- O servidor é a **única** autoridade: quando chega `game:move`, ele recria a `Position` a partir do
  FEN salvo, aplica o lance, valida, grava, e só então emite `game:move` para os dois jogadores.
- Mensagem inválida → `{ type: 'error', code, message }`, nunca derruba a conexão.

---

## 6. Web — sistema de design (tokens)

Tokens em `apps/web/src/styles/tokens.css` (CSS custom properties) + `@theme` do Tailwind v4 em
`apps/web/src/styles/app.css`.

**Paleta (identidade própria — "Castelo")**
```
--color-ground:      #1F1C19   fundo da página
--color-surface:     #2A2622   cards, sidebar
--color-raised:      #332E29   inputs, hover
--color-sunken:      #171512   rail, campos
--color-ink:         #F4EEE2
--color-ink-muted:   #A79C8C
--color-ink-faint:   #6E6558
--color-accent:      #D8A33B   brass — ação primária
--color-accent-soft: #EDBC57
--color-accent-ink:  #201A0C   texto sobre accent
--color-success:     #7FB069
--color-danger:      #D0603C
--color-info:        #5EA0A8
```

**Tabuleiros**
```
walnut : clara #EFE3CB  escura #7A5B3C  coord-clara #C3AB84  coord-escura #F0E6D2
emerald: clara #EBECD0  escura #739552  coord-clara #EBECD0  coord-escura #739552
slate : clara #E4E7EA  escura #7C8896  coord-clara #E4E7EA  coord-escura #7C8896
ice   : clara #EAF2F6  escura #9BB7C4  coord-clara #EAF2F6  coord-escura #9BB7C4
```

**Escala** — reusar a escala do Chess.com (grid de 4px): espaço `.1 .2 .4 .6 .8 1.2 1.6 2.4 3.2 4 8rem`;
raio `.2 .3 .5 1rem`; sombra só em flutuante: popover `0 .3rem .8rem rgba(0,0,0,.35)`,
modal `0 .8rem 2.4rem rgba(0,0,0,.6)`.

**Tipografia** — Space Grotesk (display, relógio, algarismos tabulares) + pilha de sistema para o corpo.
Sem gradientes, sem emoji, sem sombra em repouso, sem borda de 1px em volta de cards (separação por
passo de tom).

**Ícones** — SVG inline próprios (nunca emoji). Devem ter `aria-hidden` quando decorativos e
`currentColor` para herdar a cor do texto.

---

## 7. Regras de qualidade (todos os workstreams)

- TypeScript `strict: true`, sem `any` implícito, sem `@ts-ignore`.
- Nada de `console.log` no código de produção (usar o logger do server).
- Validação de entrada **no servidor** com zod; o cliente valida só para UX.
- Códigos de status HTTP corretos (201 criar, 400 entrada inválida, 401 não autenticado,
  403 proibido, 404 não encontrado, 409 conflito, 422 semântica, 429 rate limit).
- Toda rota mutativa protegida por CSRF.
- Nenhum segredo no repositório: `.env.example` documenta as variáveis; valores padrão de
  desenvolvimento em código, valores de produção lidos do ambiente.
- Responsividade real: 360px, 768px, 1440px. Nada de scroll horizontal. Alvos de toque >= 44px.
- Acessibilidade: `aria-label` em todo botão só com ícone, foco visível, `prefers-reduced-motion`
  respeitado, contraste >= 4.5:1 no texto.

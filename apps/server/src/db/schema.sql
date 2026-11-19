-- Castelo — schema canônico (CONTRATO §3)
-- Aplicado de forma idempotente em cada boot (CREATE TABLE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS users (
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
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,              -- sha256 do token (nunca o token bruto)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  user_agent TEXT, ip TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS games (
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
);

CREATE TABLE IF NOT EXISTS game_chat(id TEXT PRIMARY KEY, game_id TEXT REFERENCES games(id) ON DELETE CASCADE, user_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL);


-- Problemas de xadrez (posições reais com solução verificada)
CREATE TABLE IF NOT EXISTS puzzles(
  id TEXT PRIMARY KEY,
  fen TEXT NOT NULL,
  moves TEXT NOT NULL,             -- JSON: [{san, from, to, promotion?}]
  rating INTEGER NOT NULL DEFAULT 1200,
  rating_deviation INTEGER NOT NULL DEFAULT 120,
  popularity INTEGER NOT NULL DEFAULT 50,
  themes TEXT NOT NULL,            -- JSON: string[]
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS puzzle_attempts(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, puzzle_id TEXT NOT NULL, solved INTEGER NOT NULL, moves TEXT NOT NULL, rating_before INTEGER, rating_after INTEGER, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS friendships(id TEXT PRIMARY KEY, requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, addressee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(requester_id, addressee_id));

CREATE TABLE IF NOT EXISTS friends_challenges(id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, time_control TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS user_settings(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, board_theme TEXT NOT NULL DEFAULT 'walnut', piece_theme TEXT NOT NULL DEFAULT 'castelo', show_coordinates INTEGER NOT NULL DEFAULT 1, show_legal_moves INTEGER NOT NULL DEFAULT 1, animate_moves INTEGER NOT NULL DEFAULT 1, sound_enabled INTEGER NOT NULL DEFAULT 1, sound_volume INTEGER NOT NULL DEFAULT 60, default_time_control TEXT NOT NULL DEFAULT '10+5', board_orientation TEXT NOT NULL DEFAULT 'auto');

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_games_white ON games(white_id);
CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user ON puzzle_attempts(user_id);

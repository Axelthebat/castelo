import { readSessionToken, hashSessionToken } from './lib/session.ts';
import { getDb } from './db/index.ts';
import { buildApp } from './app.ts';
import { getEnv } from './env.ts';
import { RealtimeHub, attachWebSocket } from './realtime/hub.ts';
import { getRuntime, parseTimeControl } from './realtime/runtime.ts';
import { findUserById } from './repos/users.ts';
import { categoryForTimeControl } from './repos/games.ts';

const env = getEnv();
const runtime = getRuntime();
runtime.setDb(getDb());

/* ------------------------------------------------------------------ *
 * Hub WebSocket
 * ------------------------------------------------------------------ */

const hub = new RealtimeHub({
  authenticate(cookieHeader) {
    if (!cookieHeader) return null;
    // O handshake não passa pelo Fastify: montamos uma requisição mínima
    // para reaproveitar a leitura de sessão já testada.
    const fake = { headers: { cookie: cookieHeader }, cookies: {} } as never;
    const token = readSessionToken(fake);
    if (!token) return null;

    const db = getDb();
    const row = db
      .prepare(
        `SELECT s.user_id AS userId, u.username AS username, u.rating_blitz AS ratingBlitz
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > ?`,
      )
      .get(hashSessionToken(token), new Date().toISOString()) as
      | { userId: string; username: string; ratingBlitz: number }
      | undefined;

    if (!row) return null;

    return {
      id: row.userId,
      username: row.username,
      rating: row.ratingBlitz,
      avatarSeed: row.userId,
    };
  },

  registry: runtime.registry,

  createGame(a, b, ctx) {
    const ratingA = ratingFor(a, ctx.timeControl);
    const ratingB = ratingFor(b, ctx.timeControl);
    return runtime.createOnlineGame(
      { id: a.id, username: a.username, rating: ratingA },
      { id: b.id, username: b.username, rating: ratingB },
      parseTimeControl(ctx.timeControl)!,
    );
  },

  parseTimeControl(timeControl) {
    const parsed = parseTimeControl(timeControl);
    if (!parsed) throw new Error('Controle de tempo inválido');
    return { timeControl, baseMs: parsed.baseMs, incrementMs: parsed.incrementMs };
  },

  ratingFor,

  onMove: (game) => {
    // O bot responde quando é a vez dele.
    if (game.mode === 'bot' && !game.isOver()) {
      runtime.bot.schedule(game);
    }
  },

  onMovePersisted: (game) => runtime.persistMove(game),

  onGameFinished: (game) => {
    const delta = runtime.finish(game);
    if (delta && game.result) {
      game.emit({
        type: 'game:ended',
        result: game.result,
        reason: game.termination ?? 'Partida encerrada',
        ratingDelta: delta,
      });
    }
  },
});

function ratingFor(identity: { id: string; username: string; rating: number }, timeControl: string): number {
  const category = categoryForTimeControl(timeControl);
  const db = getDb();
  const user = findUserById(db, identity.id);
  if (!user) return identity.rating;
  if (category === 'bullet') return user.rating_bullet;
  if (category === 'rapid') return user.rating_rapid;
  if (category === 'classical') return user.rating_classical;
  return user.rating_blitz;
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const app = await buildApp();

  // Partidas cujo tempo acabou: encerra e persiste.
  const sweeper = setInterval(() => {
    for (const game of hub.sweepTimeouts()) {
      runtime.finish(game);
    }
  }, 2_000);
  sweeper.unref?.();

  await app.listen({ port: env.PORT, host: env.HOST });

  attachWebSocket(app.server, hub, '/ws');

  app.log.info(`Castelo no ar em http://${env.HOST}:${env.PORT}`);

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} recebido — encerrando`);
    clearInterval(sweeper);
    runtime.bot.dispose();
    hub.close();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Falha ao iniciar o servidor:', error);
  process.exit(1);
});

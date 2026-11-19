import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HttpError } from '../errors.ts';
import { parseBody } from '../lib/validate.ts';
import { requireAuth } from '../plugins/auth.ts';
import { requireCsrf } from '../lib/csrf.ts';
import { getDb } from '../db/index.ts';
import { getSession } from '../lib/session.ts';
import { getGame, getGamePgn, parseMoves } from '../repos/games.ts';

function parseStoredMoves(raw: string): ReturnType<typeof parseMoves> {
  try {
    return parseMoves(raw);
  } catch {
    return [];
  }
}
import { getRuntime, parseTimeControl } from '../realtime/runtime.ts';
import { categoryForTimeControl } from '../repos/games.ts';
import { GameError } from '../realtime/game-service.ts';

const createBotSchema = z.object({
  timeControl: z.string().regex(/^\d+\+\d+$/),
  difficulty: z.enum(['beginner', 'casual', 'strong', 'master']).default('casual'),
});
const moveSchema = z.object({
  from: z.string().regex(/^[a-h][1-8]$/),
  to: z.string().regex(/^[a-h][1-8]$/),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
});

// IDs de partidas criadas pelo seed são slugs (seed-game-scholar), não UUIDs.
const idParams = z.object({ id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/) });

function currentUser(req: FastifyRequest) {
  if (!req.currentUser) throw new HttpError(401, 'unauthorized', 'Autentique-se para continuar');
  return req.currentUser;
}

export async function registerGamesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/api/games/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const runtime = getRuntime();

    const live = runtime.registry.get(id);
    if (live) {
      const session = getSession(req);
      const participant = session ? live.playerOf(session.user.id) : null;
      const state = live.toState();
      if (!participant) {
        // um espectador só vê o essencial
        return {
          id: state.id,
          mode: state.mode,
          fen: state.fen,
          turn: state.turn,
          timeControl: state.timeControl,
          status: state.status,
          result: state.result,
          termination: state.termination,
          white: state.white,
          black: state.black,
          clock: { white: 0, black: 0, activeColor: state.clock.activeColor, running: false, lastMoveAt: null },
          moves: [],
          lastMove: null,
        };
      }
      return state;
    }

    const row = getGame(getDb(), id);
    if (!row) throw new HttpError(404, 'not-found', 'Partida não encontrada.');

    return {
      id: row.id,
      mode: row.mode,
      fen: row.fen,
      turn: row.fen.split(' ')[1] === 'b' ? 'b' : 'w',
      timeControl: row.time_control,
      status: row.status,
      result: row.result,
      termination: row.termination,
      white: { id: row.white_id ?? '', username: '', rating: 0, isBot: false, avatarSeed: '' },
      black: { id: row.black_id ?? '', username: '', rating: 0, isBot: false, avatarSeed: '' },
      clock: {
        white: row.clock_white ?? 0,
        black: row.clock_black ?? 0,
        activeColor: row.fen.split(' ')[1] === 'b' ? 'b' : 'w',
        running: row.status === 'active',
        lastMoveAt: row.clock_started_at,
      },
      moves: [],
      lastMove: null,
    };
  });

  app.get<{ Params: { id: string } }>('/api/games/:id/moves', async (req) => {
    const { id } = idParams.parse(req.params);
    const runtime = getRuntime();
    const live = runtime.registry.get(id);

    const history = live?.moves ?? parseStoredMoves(getGame(getDb(), id)?.moves ?? '[]');
    return {
      moves: history.map((move, index) => ({
        ply: index + 1,
        san: move.san,
        from: move.from,
        to: move.to,
        promotion: move.promotion,
        fen: 'fen' in move ? move.fen : '',
        clockWhite: 0,
        clockBlack: 0,
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/api/games/:id/pgn', async (req) => {
    const { id } = idParams.parse(req.params);
    const pgn = getGamePgn(getDb(), id);
    if (!pgn) throw new HttpError(404, 'not-found', 'PGN não disponível para esta partida.');
    return { pgn };
  });

  app.post('/api/games/bot', { preHandler: [requireAuth, requireCsrf] }, async (req) => {
    const user = currentUser(req);
    const payload = parseBody(createBotSchema, req.body);
    const timeControl = parseTimeControl(payload.timeControl);
    if (!timeControl) {
      throw new HttpError(400, 'validation', 'Controle de tempo inválido.', {
        timeControl: 'Use o formato "10+5".',
      });
    }

    const runtime = getRuntime();
    const game = runtime.createBotGame(
      { id: user.id, username: user.username, rating: user.rating_blitz },
      timeControl,
      payload.difficulty ?? 'casual',
    );

    return { gameId: game.id, timeControl: game.timeControl, difficulty: payload.difficulty ?? 'casual' };
  });

  app.post<{ Params: { id: string } }>(
    '/api/games/:id/move',
    { preHandler: [requireAuth, requireCsrf], config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req) => {
      const user = currentUser(req);
      const { id } = idParams.parse(req.params);
      const payload = parseBody(moveSchema, req.body);

      const runtime = getRuntime();
      const game = runtime.registry.require(id);

      try {
        const move = game.applyMove(user.id, payload.from, payload.to, payload.promotion);
        runtime.persistMove(game);
        runtime.bot.schedule(game);
        return move;
      } catch (error) {
        if (error instanceof GameError) {
          throw new HttpError(error.status, error.code, error.message);
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/games/:id/resign',
    { preHandler: [requireAuth, requireCsrf] },
    async (req) => {
      const user = currentUser(req);
      const { id } = idParams.parse(req.params);
      const runtime = getRuntime();
      const game = runtime.registry.require(id);

      try {
        game.resign(user.id);
      } catch (error) {
        if (error instanceof GameError) {
          throw new HttpError(error.status, error.code, error.message);
        }
        throw error;
      }

      const delta = runtime.finish(game);
      return { result: game.result, ratingDelta: delta };
    },
  );

  app.get('/api/games/category/:timeControl', async (req) => {
    const { timeControl } = z.object({ timeControl: z.string() }).parse(req.params);
    return { category: categoryForTimeControl(timeControl) };
  });
}

export default registerGamesRoutes;

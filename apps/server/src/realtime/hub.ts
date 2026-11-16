import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, ServerMessage, GamePlayer, QueueEntry } from '@castelo/shared';
import { GameRegistry, LiveGame, GameError } from './game-service.ts';

/* ------------------------------------------------------------------ *
 * Contratos injetados (o hub não conhece o banco nem o HTTP)
 * ------------------------------------------------------------------ */

export interface SocketIdentity {
  id: string;
  username: string;
  rating: number;
  avatarSeed: string;
  country?: string | null;
  title?: string | null;
}

export type SocketAuthenticator = (
  cookieHeader: string | undefined,
) => SocketIdentity | null;

export interface GameFactoryContext {
  timeControl: string;
  baseMs: number;
  incrementMs: number;
}

export interface HubDependencies {
  /** resolve a identidade a partir do cookie da sessão */
  authenticate: SocketAuthenticator;
  /** cria o registro de partidas */
  registry: GameRegistry;
  /** cria uma partida entre dois jogadores autenticados */
  createGame: (a: SocketIdentity, b: SocketIdentity, ctx: GameFactoryContext) => LiveGame;
  /** converte "10+5" em segundos */
  parseTimeControl: (id: string) => GameFactoryContext;
  /** rating por categoria */
  ratingFor: (identity: SocketIdentity, timeControl: string) => number;
  /** notifica a aplicação (ex.: persistir) */
  onGameFinished?: (game: LiveGame) => void;
  /** chamado depois que um lance é aplicado (ex.: o bot responde) */
  onMove?: (game: LiveGame) => void;
  /** chamado para persistir o estado da partida após um lance */
  onMovePersisted?: (game: LiveGame) => void;
}

interface Client {
  socket: WebSocket;
  identity: SocketIdentity;
  /** id da partida atual subscription */
  gameId?: string;
  unsubscribe?: () => void;
  alive: boolean;
}

const RATING_WINDOW = 200;

/* ------------------------------------------------------------------ *
 * Hub
 * ------------------------------------------------------------------ */

export class RealtimeHub {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<WebSocket, Client>();
  /** fila de matchmaking por controle de tempo */
  private readonly queues = new Map<string, QueueEntry[]>();
  private heartbeat: NodeJS.Timeout | null = null;

  private readonly deps: HubDependencies;

  constructor(deps: HubDependencies) {
    this.deps = deps;
    this.wss = new WebSocketServer({ noServer: true });
    this.heartbeat = setInterval(() => this.pingAll(), 30_000);
    this.heartbeat.unref?.();
  }

  /* ------------------------- upgrade / auth ------------------------ */

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    const identity = this.deps.authenticate(request.headers.cookie);
    if (!identity) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.register(ws, identity);
    });
  }

  private register(socket: WebSocket, identity: SocketIdentity): void {
    const client: Client = { socket, identity, alive: true };
    this.clients.set(socket, client);

    socket.on('message', (raw) => {
      void this.handleMessage(client, raw.toString());
    });

    socket.on('pong', () => {
      client.alive = true;
    });

    socket.on('close', () => {
      this.detach(client);
      this.removeFromQueues(identity.id);
      this.clients.delete(socket);
    });

    socket.on('error', () => {
      this.detach(client);
      this.removeFromQueues(identity.id);
      this.clients.delete(socket);
    });

    this.send(client, { type: 'pong' });
  }

  /* --------------------------- mensagens --------------------------- */

  private async handleMessage(client: Client, raw: string): Promise<void> {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      this.send(client, {
        type: 'error',
        code: 'bad-json',
        message: 'Mensagem inválida.',
      });
      return;
    }

    try {
      switch (message.type) {
        case 'queue:join':
          this.joinQueue(client, message.timeControl);
          return;
        case 'queue:leave':
          this.removeFromQueues(client.identity.id);
          this.send(client, { type: 'queue:left' });
          return;
        case 'game:subscribe': {
          const game = this.deps.registry.require(message.gameId);
          this.ensureSubscription(client, game);
          game.emit({ type: 'game:state', state: game.toState() });
          return;
        }
        case 'game:move': {
          const game = this.deps.registry.require(message.gameId);
          this.ensureSubscription(client, game);
          const move = game.applyMove(
            client.identity.id,
            message.from,
            message.to,
            message.promotion,
          );
          game.emit({ type: 'game:move', move });
          this.persistMove(game);
          this.deps.onMove?.(game);
          return;
        }
        case 'game:resign': {
          const game = this.deps.registry.require(message.gameId);
          this.ensureSubscription(client, game);
          game.resign(client.identity.id);
          this.finish(game);
          return;
        }
        case 'game:offer_draw': {
          const game = this.deps.registry.require(message.gameId);
          this.ensureSubscription(client, game);
          game.offerDraw(client.identity.id);
          return;
        }
        case 'game:accept_draw': {
          const game = this.deps.registry.require(message.gameId);
          this.ensureSubscription(client, game);
          if (game.acceptDraw(client.identity.id)) this.finish(game);
          return;
        }
        case 'game:rematch': {
          const game = this.deps.registry.require(message.gameId);
          this.ensureSubscription(client, game);
          this.rematch(game, client);
          return;
        }
        case 'game:chat': {
          const game = this.deps.registry.require(message.gameId);
          this.ensureSubscription(client, game);
          const text = message.text.slice(0, 500).trim();
          if (!text) return;
          game.addChat(client.identity.id, text);
          return;
        }
        case 'ping':
          this.send(client, { type: 'pong' });
          return;
        default:
          this.send(client, {
            type: 'error',
            code: 'unknown-message',
            message: 'Comando desconhecido.',
          });
      }
    } catch (error) {
      if (error instanceof GameError) {
        this.send(client, { type: 'error', code: error.code, message: error.message });
        return;
      }
      this.send(client, {
        type: 'error',
        code: 'internal',
        message: 'Não foi possível processar a jogada.',
      });
    }
  }

  /* --------------------------- matchmaking -------------------------- */

  private joinQueue(client: Client, timeControl: string): void {
    if (!this.deps.parseTimeControl(timeControl)) {
      this.send(client, {
        type: 'error',
        code: 'bad-time-control',
        message: 'Controle de tempo inválido.',
      });
      return;
    }

    this.removeFromQueues(client.identity.id);

    const rating = this.deps.ratingFor(client.identity, timeControl);
    const waiting = this.queues.get(timeControl) ?? [];

    // procura um oponente dentro da janela de rating
    let index = waiting.findIndex(
      (entry) =>
        Math.abs(entry.rating - rating) <= RATING_WINDOW &&
        entry.userId !== client.identity.id,
    );

    if (index === -1) {
      const entry: QueueEntry = {
        id: `q_${client.identity.id}`,
        userId: client.identity.id,
        username: client.identity.username,
        rating,
        timeControl,
        joinedAt: Date.now(),
      };
      waiting.push(entry);
      this.queues.set(timeControl, waiting);
      this.send(client, { type: 'queue:waiting', position: waiting.length });
      this.tryMatch(timeControl);
      return;
    }

    const opponent = waiting.splice(index, 1)[0];
    this.queues.set(timeControl, waiting);

    const opponentClient = this.findByUserId(opponent.userId);
    if (!opponentClient) {
      // o oponente desconectou — entra na fila
      const entry: QueueEntry = {
        id: `q_${client.identity.id}`,
        userId: client.identity.id,
        username: client.identity.username,
        rating,
        timeControl,
        joinedAt: Date.now(),
      };
      waiting.push(entry);
      this.queues.set(timeControl, waiting);
      this.send(client, { type: 'queue:waiting', position: waiting.length });
      return;
    }

    const ctx = this.deps.parseTimeControl(timeControl);
    const game = this.deps.createGame(client.identity, opponentClient.identity, ctx);

    this.subscribe(client, game);
    this.subscribe(opponentClient, game);

    this.send(client, { type: 'queue:left' });
    this.send(opponentClient, { type: 'queue:left' });
    this.send(client, { type: 'queue:matched', gameId: game.id });
    this.send(opponentClient, { type: 'queue:matched', gameId: game.id });

    game.emit({ type: 'game:state', state: game.toState() });
  }

  /** Chama a cada entrada na fila para tentar formar partidas. */
  private tryMatch(timeControl: string): void {
    const waiting = this.queues.get(timeControl) ?? [];
    while (waiting.length >= 2) {
      const a = waiting.shift();
      const b = waiting.shift();
      if (!a || !b) break;
      const clientA = this.findByUserId(a.userId);
      const clientB = this.findByUserId(b.userId);
      if (!clientA || !clientB) {
        if (clientA) waiting.unshift(a);
        if (clientB) waiting.unshift(b);
        break;
      }
      const ctx = this.deps.parseTimeControl(timeControl);
      const game = this.deps.createGame(clientA.identity, clientB.identity, ctx);
      this.subscribe(clientA, game);
      this.subscribe(clientB, game);
      this.send(clientA, { type: 'queue:matched', gameId: game.id });
      this.send(clientB, { type: 'queue:matched', gameId: game.id });
      game.emit({ type: 'game:state', state: game.toState() });
    }
    this.queues.set(timeControl, waiting);
  }

  private removeFromQueues(userId: string): void {
    for (const [key, list] of this.queues) {
      const filtered = list.filter((entry) => entry.userId !== userId);
      if (filtered.length !== list.length) {
        this.queues.set(key, filtered);
        // notifica os restantes sobre a posição
        filtered.forEach((entry, index) => {
          const client = this.findByUserId(entry.userId);
          if (client) this.send(client, { type: 'queue:waiting', position: index + 1 });
        });
      }
    }
  }

  /* ---------------------------- jogadas ---------------------------- */

  private rematch(game: LiveGame, client: Client): void {
    const opponent = this.findByUserId(
      game.colorOf(client.identity.id) === 'w' ? game.black.id : game.white.id,
    );
    if (!opponent) {
      this.send(client, {
        type: 'error',
        code: 'opponent-offline',
        message: 'O adversário não está online.',
      });
      return;
    }

    const ctx = this.deps.parseTimeControl(game.timeControl);
    const next = this.deps.createGame(game.white.id === client.identity.id ? opponent.identity : client.identity,
      game.white.id === client.identity.id ? client.identity : opponent.identity,
      ctx);
    this.subscribe(client, next);
    this.subscribe(opponent, next);
    this.send(client, { type: 'queue:matched', gameId: next.id });
    this.send(opponent, { type: 'queue:matched', gameId: next.id });
    next.emit({ type: 'game:state', state: next.toState() });
  }

  /* --------------------------- assinaturas -------------------------- */

  subscribe(client: Client, game: LiveGame): void {
    client.unsubscribe?.();
    client.gameId = game.id;
    const unsubscribe = game.subscribe((message) => {
      this.send(client, message);
    });
    client.unsubscribe = unsubscribe;
  }

  /**
   * Garante que o socket receba os eventos da partida. Só participantes
   * assistem — o chat e o estado são privados da partida.
   */
  private ensureSubscription(client: Client, game: LiveGame): void {
    if (client.gameId === game.id) return;
    if (!game.playerOf(client.identity.id)) {
      throw new GameError('forbidden', 'Você não participa desta partida.', 403);
    }
    this.subscribe(client, game);
  }

  private detach(client: Client): void {
    client.unsubscribe?.();
    client.unsubscribe = undefined;
    client.gameId = undefined;
  }

  /* ----------------------------- helpers --------------------------- */

  findByUserId(userId: string): Client | undefined {
    for (const client of this.clients.values()) {
      if (client.identity.id === userId) return client;
    }
    return undefined;
  }

  send(client: Client, message: ServerMessage): void {
    if (client.socket.readyState !== WebSocket.OPEN) return;
    client.socket.send(JSON.stringify(message));
  }

  sendToUser(userId: string, message: ServerMessage): void {
    const client = this.findByUserId(userId);
    if (client) this.send(client, message);
  }

  private persistMove(game: LiveGame): void {
    this.deps.onMovePersisted?.(game);
  }

  private finish(game: LiveGame): void {
    this.deps.onGameFinished?.(game);
  }

  private pingAll(): void {
    for (const client of this.clients.values()) {
      if (!client.alive) {
        client.socket.terminate();
        continue;
      }
      client.alive = false;
      try {
        client.socket.ping();
      } catch {
        /* ignora */
      }
    }
  }

  /** Encerra partidas cujo tempo acabou. Chamado por um timer do servidor. */
  sweepTimeouts(now = Date.now()): LiveGame[] {
    const expired: LiveGame[] = [];
    for (const game of this.deps.registry.list()) {
      if (game.isOver()) continue;
      if (game.remaining(game.active, now) <= 0) {
        const winner = game.active === 'w' ? '0-1' : '1-0';
        game.finish(winner, 'Tempo esgotado', now);
        this.finish(game);
        expired.push(game);
      }
    }
    return expired;
  }

  close(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    for (const client of this.clients.values()) {
      try {
        client.socket.close(1001, 'Servidor encerrando');
      } catch {
        /* ignora */
      }
    }
    this.wss.close();
  }
}

export function attachWebSocket(
  server: Server,
  hub: RealtimeHub,
  path = '/ws',
): void {
  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== path) return; // deixa outros upgrades passarem
    hub.handleUpgrade(request, socket as never, head as Buffer);
  });
}

export type { GamePlayer };

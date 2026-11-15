import type { ClientMessage, ServerMessage } from '@castelo/shared';

type Handler = (message: ServerMessage) => void;
type StatusHandler = (status: SocketStatus) => void;

export type SocketStatus = 'connecting' | 'open' | 'closed' | 'reconnecting';

const RECONNECT_BASE_MS = 700;
const RECONNECT_MAX_MS = 8_000;
const PING_INTERVAL_MS = 25_000;

/**
 * Cliente WebSocket com reconexão exponencial, heartbeat e fila de mensagens
 * enviadas enquanto a conexão está fora do ar.
 */
export class GameSocket {
  private socket: WebSocket | null = null;
  private readonly handlers = new Set<Handler>();
  private readonly statusHandlers = new Set<StatusHandler>();
  private queue: ClientMessage[] = [];
  private retries = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private closedByUser = false;
  private _status: SocketStatus = 'closed';

  constructor(private readonly path = '/ws') {}

  get status(): SocketStatus {
    return this._status;
  }

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.closedByUser = false;
    this._setStatus(this.retries === 0 ? 'connecting' : 'reconnecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}${this.path}`);
    this.socket = socket;

    socket.onopen = () => {
      this.retries = 0;
      this._setStatus('open');
      const pending = this.queue;
      this.queue = [];
      for (const message of pending) socket.send(JSON.stringify(message));
      this.pingTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping' }));
      }, PING_INTERVAL_MS);
    };

    socket.onmessage = (event) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }
      for (const handler of this.handlers) handler(parsed);
    };

    socket.onclose = () => {
      if (this.pingTimer) {
        window.clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      this.socket = null;
      this._setStatus('closed');
      if (!this.closedByUser) this.scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  private scheduleReconnect(): void {
    this._setStatus('reconnecting');
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.retries, RECONNECT_MAX_MS);
    this.retries += 1;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private _setStatus(status: SocketStatus): void {
    if (this._status === status) return;
    this._status = status;
    for (const handler of this.statusHandlers) handler(status);
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }
    this.queue.push(message);
    this.connect();
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this._status);
    return () => this.statusHandlers.delete(handler);
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    if (this.pingTimer) window.clearInterval(this.pingTimer);
    this.socket?.close(1000, 'closed by client');
    this.socket = null;
    this._setStatus('closed');
  }
}

let shared: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!shared) shared = new GameSocket();
  return shared;
}

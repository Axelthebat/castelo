import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Position, type MoveInfo } from '@castelo/engine';
import type { GameMove, GameState, ServerMessage } from '@castelo/shared';
import { getSocket } from '../lib/socket.ts';
import { playSound } from '../lib/sound.ts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { ChessBoard } from '../components/board/ChessBoard.tsx';
import { GameChat, MoveList, PlayerBar, type ChatLine } from '../components/game/GamePanels.tsx';
import { GameReplay } from '../components/game/Replay.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Spinner } from '../components/ui/Spinner.tsx';
import { Icon } from '../components/icons.tsx';

type Tab = 'moves' | 'chat';

export default function GamePage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('moves');
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [reviewMoves, setReviewMoves] = useState<GameMove[]>([]);
  const [reviewPgn, setReviewPgn] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: ({ signal }) => api.settings(signal),
    enabled: Boolean(user),
  });
  const soundRef = useRef({ enabled: false, volume: 60 });
  soundRef.current = {
    enabled: settings.data?.soundEnabled ?? false,
    volume: settings.data?.soundVolume ?? 60,
  };
  const sound = (kind: 'move' | 'capture' | 'check' | 'end' | 'invalid') =>
    playSound(kind, soundRef.current.enabled, soundRef.current.volume);

  const positionRef = useRef<Position | null>(null);

  /* ----------------------------- carregamento ---------------------------- */

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setChat([]);
    setSelected(null);
    positionRef.current = null;

    async function load() {
      try {
        const { api } = await import('../lib/api.ts');
        const game = await api.game(id);
        if (cancelled) return;
        setState(game);
        positionRef.current = new Position(game.fen);
        getSocket().send({ type: 'game:subscribe', gameId: id });
      } catch {
        if (!cancelled) setNotice('Não foi possível carregar a partida.');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* ------------------------------ realtime ------------------------------ */

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    const offStatus = socket.onStatus((status) => setConnected(status === 'open'));
    const offMessage = socket.on((message: ServerMessage) => {
      if (message.type === 'game:state') {
        setState(message.state);
        positionRef.current = new Position(message.state.fen);
      } else if (message.type === 'game:move') {
        setState((previous) =>
          previous
            ? {
                ...previous,
                fen: message.move.fen,
                turn: message.move.fen.split(' ')[1] === 'b' ? 'b' : 'w',
                moves: [...previous.moves, message.move.san],
                lastMove: { from: message.move.from, to: message.move.to },
                clock: {
                  ...previous.clock,
                  white: message.move.clockWhite,
                  black: message.move.clockBlack,
                  activeColor: message.move.fen.split(' ')[1] === 'b' ? 'b' : 'w',
                  lastMoveAt: Date.now(),
                },
              }
            : previous,
        );
        positionRef.current = new Position(message.move.fen);
        const san = message.move.san;
        sound(san.includes('#') || san.includes('+') ? 'check' : san.includes('x') ? 'capture' : 'move');
        setSelected(null);
        setLegalTargets([]);
      } else if (message.type === 'game:chat') {
        setChat((previous) => [...previous, { from: message.from, text: message.text, at: message.at }]);
      } else if (message.type === 'game:ended') {
        sound('end');
        setState((previous) =>
          previous
            ? { ...previous, status: 'finished', result: message.result, termination: message.reason }
            : previous,
        );
      } else if (message.type === 'error') {
        sound('invalid');
        setNotice(message.message);
      }
    });

    return () => {
      offStatus();
      offMessage();
    };
  }, []);

  /* ----------------------------- revisão ----------------------------- */

  useEffect(() => {
    if (state?.status !== 'finished') return;
    let cancelled = false;
    void import('../lib/api.ts').then(async ({ api }) => {
      try {
        const [moves, pgn] = await Promise.all([api.gameMoves(id), api.gamePgn(id)]);
        if (cancelled) return;
        setReviewMoves(moves.moves);
        setReviewPgn(pgn.pgn);
      } catch {
        if (!cancelled) setReviewPgn(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state?.status, id]);

  /* ------------------------------- relógio ------------------------------- */

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  const clocks = useMemo(() => {
    if (!state) return { w: 0, b: 0 };
    const lastMoveAt = state.clock.lastMoveAt ?? now;
    const elapsed = state.clock.running ? Math.max(0, now - lastMoveAt) : 0;
    return {
      w: Math.max(0, state.clock.white - (state.clock.activeColor === 'w' ? elapsed : 0)),
      b: Math.max(0, state.clock.black - (state.clock.activeColor === 'b' ? elapsed : 0)),
    };
  }, [state, now]);

  /* -------------------------------- jogadas ------------------------------- */

  const myColor = useMemo<'w' | 'b' | null>(() => {
    if (!state || !user) return null;
    if (state.white.id === user.id) return 'w';
    if (state.black.id === user.id) return 'b';
    return null;
  }, [state, user]);

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!state || !myColor || state.status === 'finished') return;
      const position = positionRef.current;
      if (!position) return;

      if (selected) {
        const candidates = position.legalMovesFrom(selected).filter((move: MoveInfo) => move.to === square);
        if (candidates.length > 0) {
          const move = candidates[0];
          getSocket().send({
            type: 'game:move',
            gameId: id,
            from: selected,
            to: square,
            promotion: move.promotion,
          });
          setSelected(null);
          setLegalTargets([]);
          return;
        }
      }

      const piece = position.get(square);
      if (piece && piece.color === position.turn() && position.turn() === myColor) {
        setSelected(square);
        setLegalTargets(position.legalMovesFrom(square).map((move: MoveInfo) => move.to));
      } else {
        setSelected(null);
        setLegalTargets([]);
      }
    },
    [state, myColor, selected, id],
  );

  /* -------------------------------- ações -------------------------------- */

  function sendChat(text: string) {
    getSocket().send({ type: 'game:chat', gameId: id, text });
  }

  if (!state) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center">
        {notice ? (
          <div className="text-center">
            <p className="text-[var(--color-ink-muted)]">{notice}</p>
            <Button to="/play" variant="secondary" className="mt-4">
              Voltar para jogar
            </Button>
          </div>
        ) : (
          <Spinner size={28} />
        )}
      </div>
    );
  }

  const top = myColor === 'b' ? state.black : state.white;
  const bottom = myColor === 'b' ? state.white : state.black;
  const topColor = myColor === 'b' ? 'b' : 'w';
  const bottomColor = myColor === 'b' ? 'w' : 'b';
  const finished = state.status === 'finished';

  // A revisão ocupa a página inteira: o replay tem duas colunas próprias.
  if (finished) {
    return (
      <div className="mx-auto max-w-[78rem] px-4 py-6 lg:px-6">
        <GameReplay
          moves={reviewMoves}
          orientation={myColor ?? 'w'}
          result={state.result}
          termination={state.termination}
          pgn={reviewPgn}
          onRematch={() => getSocket().send({ type: 'game:rematch', gameId: id })}
          onExit={() => navigate('/games')}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[78rem] gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-6">
      {/* Coluna do tabuleiro */}
      <div className="mx-auto w-full max-w-[36rem]">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--color-ink-faint)]">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-ink-faint)]'}`}
            />
            {connected ? 'Conectado' : 'Reconectando…'}
          </span>
          <span className="tabular-nums">{state.timeControl}</span>
        </div>

        <PlayerBar
          player={top}
          color={topColor}
          remaining={topColor === 'w' ? clocks.w : clocks.b}
          active={state.turn === topColor && !finished}
          connected
        />

        <div className="my-2">
          <ChessBoard
            fen={state.fen}
            orientation={myColor ?? 'w'}
            lastMove={state.lastMove}
            selected={selected}
            legalTargets={legalTargets}
            onSquareClick={handleSquareClick}
            showCoordinates
            showLegalMoves
            animateMoves
            theme="walnut"
            disabled={finished || !myColor}
            ariaLabel="Tabuleiro da partida"
          />
        </div>

        <PlayerBar
          player={bottom}
          color={bottomColor}
          remaining={bottomColor === 'w' ? clocks.w : clocks.b}
          active={state.turn === bottomColor && !finished}
          connected
          canAct={!finished && Boolean(myColor)}
          onResign={() => getSocket().send({ type: 'game:resign', gameId: id })}
          onOfferDraw={() => getSocket().send({ type: 'game:offer_draw', gameId: id })}
        />
      </div>

      {/* Painel lateral */}
      <aside className="flex min-h-[24rem] flex-col overflow-hidden rounded-lg bg-[var(--color-surface)]">
        <>
            <div role="tablist" aria-label="Painel da partida" className="flex border-b border-[var(--color-hairline)]"> {/* taste-skill-ignore: linhas de dados/tabela */}
              {(['moves', 'chat'] as Tab[]).map((value) => (
                <button
                  key={value}
                  role="tab"
                  type="button"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    tab === value
                      ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-ink)]'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {value === 'moves' ? 'Lances' : 'Chat'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === 'moves' ? (
                <MoveList moves={state.moves} />
              ) : (
                <GameChat lines={chat} onSend={sendChat} disabled={!myColor} />
              )}
            </div>

            <div className="border-t border-[var(--color-hairline)] p-3"> {/* taste-skill-ignore: linhas de dados/tabela */}
              <Link
                to="/play"
                className="flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-raised)] hover:text-[var(--color-ink)]"
              >
                <Icon name="arrow-left" size={15} />
                Voltar para jogar
              </Link>
            </div>
        </>
      </aside>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GamePlayer, GameState } from '@castelo/shared';
import { Avatar } from '../ui/Avatar.tsx';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../icons.tsx';
import { formatClockPrecise, formatRating } from '../../lib/format.ts';

/* ------------------------------------------------------------------ *
 * Barra do jogador com relógio
 * ------------------------------------------------------------------ */

export interface PlayerBarProps {
  player: GamePlayer;
  color: 'w' | 'b';
  remaining: number;
  active: boolean;
  connected?: boolean;
  onResign?: () => void;
  onOfferDraw?: () => void;
  canAct?: boolean;
}

export function PlayerBar({
  player,
  color,
  remaining,
  active,
  connected = true,
  onResign,
  onOfferDraw,
  canAct = false,
}: PlayerBarProps) {
  const low = remaining <= 20_000;
  const critical = remaining <= 5_000;

  return (
    <div className="flex items-center gap-3 rounded-md bg-[var(--color-surface)] px-3 py-2">
      <Avatar seed={player.username} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            to={`/profile/${player.username}`}
            className="truncate font-medium hover:underline underline-offset-4"
          >
            {player.username}
          </Link>
          {player.isBot && <span className="text-[var(--color-ink-faint)]">· bot</span>}
          {!connected && (
            <span className="text-xs text-[var(--color-ink-faint)]">desconectado</span>
          )}
        </div>
        <span className="text-xs tabular-nums text-[var(--color-ink-faint)]">
          {formatRating(player.rating)}
        </span>
      </div>

      {canAct && (
        <div className="hidden gap-1 sm:flex">
          <Button variant="ghost" size="sm" onClick={onOfferDraw}>
            <Icon name="handshake" size={15} />
            Empatar
          </Button>
          <Button variant="ghost" size="sm" onClick={onResign}>
            Desistir
          </Button>
        </div>
      )}

      <span
        className={`min-w-[4.5rem] rounded-md px-2 py-1 text-center font-semibold tabular-nums transition-colors ${
          color === 'w' ? 'bg-[var(--color-sunken)]' : 'bg-[var(--color-sunken)]'
        } ${
          critical
            ? 'bg-[var(--color-danger)] text-[var(--color-danger-ink)]'
            : low
              ? 'bg-[var(--color-danger)]/18 text-[var(--color-danger)]'
              : 'bg-[var(--color-raised)]'
        } ${active ? 'ring-1 ring-[var(--color-accent)]' : ''}`}
        aria-label={`Tempo de ${color === 'w' ? 'brancas' : 'pretas'}`}
      >
        {formatClockPrecise(remaining)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Lista de lances
 * ------------------------------------------------------------------ */

export function MoveList({ moves, onSelect }: { moves: string[]; onSelect?: (ply: number) => void }) {
  const rows: { number: number; white?: string; black?: string }[] = useMemo(() => {
    const result: { number: number; white?: string; black?: string }[] = [];
    for (let index = 0; index < moves.length; index += 2) {
      result.push({
        number: index / 2 + 1,
        white: moves[index],
        black: moves[index + 1],
      });
    }
    return result;
  }, [moves]);

  if (moves.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-[var(--color-ink-faint)]">
        Os lances aparecem aqui quando a partida começa.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-[var(--color-hairline)]"> {/* taste-skill-ignore: linhas de tabela de lances */}
      {rows.map((row) => (
        <li key={row.number} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1 px-3 py-1.5 text-sm">
          <span className="text-right tabular-nums text-[var(--color-ink-faint)]">{row.number}.</span>
          <button
            type="button"
            onClick={() => onSelect?.((row.number - 1) * 2 + 1)}
            className="rounded px-1.5 py-0.5 text-left tabular-nums transition-colors hover:bg-[var(--color-raised)]"
          >
            {row.white}
          </button>
          <button
            type="button"
            disabled={!row.black}
            onClick={() => row.black && onSelect?.((row.number - 1) * 2 + 2)}
            className="rounded px-1.5 py-0.5 text-left tabular-nums transition-colors hover:bg-[var(--color-raised)] disabled:opacity-30"
          >
            {row.black}
          </button>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ *
 * Chat
 * ------------------------------------------------------------------ */

export interface ChatLine {
  from: string;
  text: string;
  at: number;
}

export function GameChat({
  lines,
  onSend,
  disabled,
}: {
  lines: ChatLine[];
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [lines.length]);

  function submit() {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
  }

  return (
    <div className="flex h-full min-h-[16rem] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {lines.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-faint)]">
            A mensagem é visível só nesta partida.
          </p>
        ) : (
          lines.map((line, index) => (
            <p key={`${line.at}-${index}`} className="text-sm">
              <span className="font-medium">{line.from}: </span>
              <span className="text-[var(--color-ink-muted)]">{line.text}</span>
            </p>
          ))
        )}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 border-t border-[var(--color-hairline)] p-3"> {/* taste-skill-ignore: linhas de dados/tabela */}
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          maxLength={500}
          placeholder="Mensagem"
          aria-label="Mensagem para o adversário"
          disabled={disabled}
          className="h-10 flex-1 rounded-md border border-[var(--color-hairline)] bg-[var(--color-sunken)] px-3 text-sm outline-none transition-colors placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-accent)]"
        />
        <Button variant="secondary" size="sm" onClick={submit} disabled={disabled || !text.trim()}>
          <Icon name="send" size={15} />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Fim de partida
 * ------------------------------------------------------------------ */

export function GameOverPanel({
  state,
  perspective,
  onRematch,
  onExit,
}: {
  state: GameState;
  perspective: 'w' | 'b';
  onRematch?: () => void;
  onExit: () => void;
}) {
  const won =
    state.result === '1-0' ? perspective === 'w' : state.result === '0-1' ? perspective === 'b' : false;
  const draw = state.result === '1/2-1/2';

  return (
    <div className="rounded-lg bg-[var(--color-surface)] p-6 text-center">
      <p className="text-2xl font-bold tracking-tight">
        {draw ? 'Empate' : won ? 'Você venceu' : 'Você perdeu'}
      </p>
      <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
        {state.termination ? state.termination : 'Partida encerrada'}
      </p>
      {state.ratingDelta && (
        <p className="mt-3 text-sm tabular-nums">
          <span
            className={
              (state.ratingDelta[perspective === 'w' ? 'white' : 'black'] ?? 0) >= 0
                ? 'text-[var(--color-success)]'
                : 'text-[var(--color-danger)]'
            }
          >
            {state.ratingDelta[perspective === 'w' ? 'white' : 'black'] >= 0 ? '+' : ''}
            {state.ratingDelta[perspective === 'w' ? 'white' : 'black']}
          </span>
          <span className="text-[var(--color-ink-faint)]"> de rating</span>
        </p>
      )}
      <div className="mt-5 flex justify-center gap-2">
        {onRematch && (
          <Button variant="primary" onClick={onRematch}>
            Revanche
          </Button>
        )}
        <Button variant="secondary" onClick={onExit}>
          Sair
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { GameMove, GameState } from '@castelo/shared';
import { START_FEN } from '@castelo/engine';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../icons.tsx';
import { translateTermination } from '../../lib/format.ts';
import { MoveList } from './GamePanels.tsx';

interface ReplayProps {
  moves: GameMove[];
  orientation: 'w' | 'b';
  result?: string | null;
  termination?: string | null;
  pgn?: string | null;
  onRematch?: () => void;
  onExit?: () => void;
}

/** Revisão de uma partida encerrada, com navegação lance a lance. */
export function GameReplay({
  moves,
  orientation,
  result,
  termination,
  pgn,
  onRematch,
  onExit,
}: ReplayProps) {
  const [ply, setPly] = useState(0);

  const fen = useMemo(() => {
    if (ply === 0) return START_FEN;
    const move = moves[ply - 1];
    return move?.fen ?? START_FEN;
  }, [moves, ply]);

  const lastMove = useMemo(() => {
    const move = moves[ply - 1];
    return move ? { from: move.from, to: move.to } : null;
  }, [moves, ply]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') setPly((value) => Math.max(0, value - 1));
      if (event.key === 'ArrowRight') setPly((value) => Math.min(moves.length, value + 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moves.length]);

  const resultLabel =
    result === '1/2-1/2' ? 'Empate' : result === '1-0' ? 'Brancas venceram' : result === '0-1' ? 'Pretas venceram' : 'Sem resultado';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,20rem)] lg:items-start">
      <div>
        <ChessBoard
          fen={fen}
          orientation={orientation}
          lastMove={lastMove}
          showCoordinates
          showLegalMoves={false}
          animateMoves
          theme="walnut"
          ariaLabel={`Tabuleiro da partida, lance ${ply} de ${moves.length}`}
        />
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[var(--color-surface)] p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPly(0)}
            disabled={ply === 0}
            aria-label="Primeiro lance"
          >
            <Icon name="arrow-left" size={16} />
            <Icon name="arrow-left" size={16} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPly((value) => Math.max(0, value - 1))}
            disabled={ply === 0}
            aria-label="Lance anterior"
          >
            <Icon name="arrow-left" size={16} />
          </Button>
          <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-[var(--color-ink-muted)]">
            {ply} / {moves.length}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPly((value) => Math.min(moves.length, value + 1))}
            disabled={ply === moves.length}
            aria-label="Próximo lance"
          >
            <Icon name="arrow-right" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPly(moves.length)}
            disabled={ply === moves.length}
            aria-label="Último lance"
          >
            <Icon name="arrow-right" size={16} />
            <Icon name="arrow-right" size={16} />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-[var(--color-ink-faint)]">
          Use as setas do teclado para navegar
        </p>
      </div>

      <aside className="flex flex-col gap-3">
        <div className="rounded-lg bg-[var(--color-surface)] p-4">
          <p className="text-lg font-semibold">{resultLabel}</p>
          {termination && (
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {translateTermination(termination)}
            </p>
          )}
        </div>

        <div className="max-h-[22rem] overflow-y-auto rounded-lg bg-[var(--color-surface)]">
          <MoveList
            moves={moves.map((move) => move.san)}
            onSelect={(index) => setPly(index + 1)}
          />
        </div>

        {pgn && (
          <div className="rounded-lg bg-[var(--color-surface)] p-4">
            <p className="mb-2 text-sm font-medium">PGN</p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--color-ink-muted)]">
              {pgn}
            </pre>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => void navigator.clipboard?.writeText(pgn)}
            >
              <Icon name="copy" size={15} />
              Copiar PGN
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          {onRematch && (
            <Button variant="primary" onClick={onRematch}>
              Revanche
            </Button>
          )}
          {onExit && (
            <Button variant="secondary" onClick={onExit}>
              Sair
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}

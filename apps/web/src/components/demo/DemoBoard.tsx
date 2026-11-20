import { useCallback, useMemo, useState } from 'react';
import { Position, type MoveInfo } from '@castelo/engine';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../icons.tsx';

/** Abertura italiana — sequência legal verificada lance a lance. */
const OPENING: string[] = [
  'e2e4',
  'e7e5',
  'g1f3',
  'b8c6',
  'f1c4',
  'f8c5',
  'e1g1',
  'g8f6',
  'd2d3',
  'd7d6',
];

/**
 * Tabuleiro jogável da home — a "coisa viva" da página.
 * É um posição real, com regras reais; nada é simulado.
 */
export function DemoBoard() {
  const [position, setPosition] = useState(() => new Position());
  const [selected, setSelected] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const legalTargets = useMemo(() => {
    if (!selected) return [];
    return position
      .legalMovesFrom(selected)
      .map((move: MoveInfo) => move.to);
  }, [position, selected]);

  const handleSquareClick = useCallback(
    (square: string) => {
      if (selected) {
        const candidates = position.legalMovesFrom(selected).filter((move) => move.to === square);
        if (candidates.length > 0) {
          const move = position.move(selected, square, candidates[0].promotion);
          setPosition(new Position(position.fen()));
          setLastMove({ from: move.from, to: move.to });
          setHistory((previous) => [...previous, move.san]);
          setSelected(null);
          return;
        }
      }
      const piece = position.get(square);
      if (piece && piece.color === position.turn()) {
        setSelected(square);
      } else {
        setSelected(null);
      }
    },
    [position, selected],
  );

  function reset() {
    setPosition(new Position());
    setSelected(null);
    setLastMove(null);
    setHistory([]);
  }

  function playOpening() {
    const next = new Position();
    try {
      for (const move of OPENING) {
        next.move(move.slice(0, 2), move.slice(2, 4));
      }
    } catch {
      // Abertura inválida: mantém a posição inicial.
      reset();
      return;
    }
    setPosition(next);
    setSelected(null);
    setHistory(next.history().map((move) => move.san));
    const last = OPENING.at(-1)!;
    setLastMove({ from: last.slice(0, 2), to: last.slice(2, 4) });
  }

  return (
    <div className="w-full max-w-[30rem]">
      <div className="rounded-lg bg-[var(--color-surface)] p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-ink-muted)]">
            {history.length > 0 ? `${history.length} lances jogados` : 'Clique numa peça para mover'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={playOpening}>
              <Icon name="book" size={15} />
              Abertura
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Reiniciar
            </Button>
          </div>
        </div>

        <ChessBoard
          fen={position.fen()}
          orientation="w"
          lastMove={lastMove}
          selected={selected}
          legalTargets={legalTargets}
          onSquareClick={handleSquareClick}
          showCoordinates
          showLegalMoves
          animateMoves
          theme="walnut"
          ariaLabel="Tabuleiro de demonstração. Clique numa peça e depois na casa de destino."
        />

        {history.length > 0 && (
          <p className="mt-3 font-[var(--font-display)] tabular-nums text-xs leading-relaxed text-[var(--color-ink-faint)]">
            {history.join(' ')}
          </p>
        )}
      </div>
    </div>
  );
}

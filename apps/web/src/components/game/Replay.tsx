import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameMove } from '@castelo/shared';
import { START_FEN } from '@castelo/engine';
import { ChessBoard } from '../board/ChessBoard.tsx';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../icons.tsx';
import { useToast } from '../ui/Toast.tsx';
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

/** Lê o lance alvo de `?ply=N` na hora da montagem. */
function plyFromUrl(): number {
  const raw = Number(new URLSearchParams(window.location.search).get('ply') ?? 0);
  return Number.isFinite(raw) && raw > 0 ? Math.max(0, Math.floor(raw)) : 0;
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
  const initialPly = useRef(plyFromUrl());
  const [ply, setPly] = useState(initialPly.current);
  const appliedInitialPly = useRef(false);
  const toast = useToast();

  const fen = useMemo(() => {
    if (ply === 0) return START_FEN;
    return moves[ply - 1]?.fen ?? START_FEN;
  }, [moves, ply]);

  const lastMove = useMemo(() => {
    const move = moves[ply - 1];
    return move ? { from: move.from, to: move.to } : null;
  }, [moves, ply]);

  /*
   * Os lances chegam depois que a partida termina. Aplicamos o lance da URL
   * somente quando eles existem — se clampássemos contra `moves.length === 0`
   * na montagem, um link `?ply=3` seria zerado antes do carregamento.
   */
  useEffect(() => {
    if (moves.length === 0 || appliedInitialPly.current) return;
    appliedInitialPly.current = true;
    setPly(Math.min(initialPly.current, moves.length));
  }, [moves.length]);

  /* A URL sempre reflete o lance atual, então o link copiado abre exatamente aqui. */
  useEffect(() => {
    const url = new URL(window.location.href);
    if (ply === 0) url.searchParams.delete('ply');
    else url.searchParams.set('ply', String(ply));
    window.history.replaceState(null, '', url);
  }, [ply]);

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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(ply > 0 ? `Link copiado — abre no lance ${ply}.` : 'Link da partida copiado.');
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  const copyPgn = async () => {
    if (!pgn) return;
    try {
      await navigator.clipboard.writeText(pgn);
      toast.success('PGN copiado.');
    } catch {
      toast.error('Não foi possível copiar o PGN.');
    }
  };

  const share = async () => {
    const data = {
      title: 'Partida no Castelo',
      text: pgn ? `Confira esta partida no Castelo:\n\n${pgn}` : 'Confira esta partida no Castelo.',
      url: window.location.href,
    };
    const nav = navigator as Navigator & { share?: (value: typeof data) => Promise<void> };
    if (typeof nav.share === 'function') {
      try {
        await nav.share(data);
        return;
      } catch (error) {
        /* O usuário cancelando a folha nativa não é erro. */
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await copyLink();
  };

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
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => void copyPgn()}>
              <Icon name="copy" size={15} />
              Copiar PGN
            </Button>
          </div>
        )}

        <div className="rounded-lg bg-[var(--color-surface)] p-4">
          <p className="mb-2 text-sm font-medium">Compartilhar</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
              <Icon name="link" size={15} />
              Copiar link
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void share()}>
              <Icon name="send" size={15} />
              Compartilhar
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-ink-faint)]">
            O link abre no lance {ply} de {moves.length}. Compartilhe com quem quiser —
            não é preciso ter conta.
          </p>
        </div>

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

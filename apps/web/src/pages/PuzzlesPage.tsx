import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { THEME_LABELS } from '../lib/format.ts';
import { ChessBoard } from '../components/board/ChessBoard.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { Icon } from '../components/icons.tsx';

interface PuzzleSolution {
  san: string;
  from: string;
  to: string;
  promotion?: string;
}
export default function PuzzlesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [solved, setSolved] = useState<boolean | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [fen, setFen] = useState<string | null>(null);
  const [solution, setSolution] = useState<PuzzleSolution[]>([]);
  const [step, setStep] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);

  const ratingQuery = useQuery({
    queryKey: ['puzzle-rating'],
    queryFn: ({ signal }) => api.puzzleRating(signal),
    enabled: Boolean(user),
  });

  const puzzleQuery = useQuery({
    queryKey: ['next-puzzle', ratingQuery.data?.rating],
    queryFn: ({ signal }) => api.nextPuzzle(ratingQuery.data?.rating, signal),
    enabled: Boolean(user),
    retry: 0,
  });

  useEffect(() => {
    if (!puzzleQuery.data) return;
    const puzzle = puzzleQuery.data.puzzle;
    setFen(puzzle.fen);
    setSolution(puzzle.solution ?? []);
    setStep(0);
    setMoves([]);
    setSolved(null);
    setHint(null);
    setSelected(null);
  }, [puzzleQuery.data]);

  const attempt = useMutation({
    mutationFn: (played: string[]) => api.attemptPuzzle(puzzleQuery.data!.puzzle.id, played),
    onSuccess: (result) => {
      setRating(result.ratingAfter);
      setSolved(result.solved);
    },
  });

  const handleSquareClick = useCallback(
    (square: string) => {
      if (!solution.length || solved !== null) return;

      const expected = solution[step];
      if (!expected) return;

      if (!selected) {
        setSelected(square);
        return;
      }

      if (selected === expected.from && square === expected.to) {
        // O servidor valida a solução: enviamos as jogadas em UCI.
        const uci = `${expected.from}${expected.to}${expected.promotion ?? ''}`;
        const nextMoves = [...moves, uci];
        setMoves(nextMoves);
        setSelected(null);

        if (step + 1 >= solution.length) {
          attempt.mutate(nextMoves);
        } else {
          setStep((value) => value + 1);
          setHint(
            solution[step + 1]
              ? `Correto. Agora encontre: ${solution[step + 1].san}`
              : null,
          );
        }
        return;
      }

      // lance errado: reinicia a tentativa
      setSelected(square);
      setMoves([]);
      setStep(0);
      setHint('Não era esse o lance. Tente de novo a partir da posição inicial.');
    },
    [solution, step, selected, moves, solved, attempt],
  );

  const legalTargets = useMemo(() => (selected ? [] : []), [selected]);

  if (!user) {
    return (
      <div className="mx-auto max-w-[52rem] px-5 py-14">
        <EmptyState
          icon={<Icon name="target" />}
          title="Entre para treinar tática"
          description="O nível se ajusta sozinho, com base nos seus acertos e erros."
          action={
            <Button to="/register" variant="primary">
              Criar conta
            </Button>
          }
        />
      </div>
    );
  }

  const puzzle = puzzleQuery.data?.puzzle;

  return (
    <div className="mx-auto grid max-w-[70rem] gap-6 px-5 py-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:py-14">
      <div className="mx-auto w-full max-w-[26rem]">
        {puzzleQuery.isLoading || !fen ? (
          <Skeleton className="aspect-square w-full" />
        ) : puzzleQuery.isError ? (
          <Card className="p-6">
            <EmptyState
              icon={<Icon name="target" />}
              title="Nenhum problema disponível"
              description="Não há problemas cadastrados para este nível de rating."
              action={
                <Button to="/play" variant="secondary">
                  Jogar uma partida
                </Button>
              }
            />
          </Card>
        ) : (
          <ChessBoard
            fen={fen}
            orientation="w"
            selected={selected}
            legalTargets={legalTargets}
            onSquareClick={handleSquareClick}
            showCoordinates
            showLegalMoves={false}
            theme="walnut"
            disabled={solved !== null}
            ariaLabel="Tabuleiro do problema"
          />
        )}
      </div>

      <div className="mx-auto w-full max-w-[32rem]">
        <h1 className="text-[2rem] font-bold tracking-[-0.02em]">Problemas</h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          Encontre o lance. Errou? A posição volta ao início — repetir é o que fixa o padrão.
        </p>

        {puzzle && (
          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-md bg-[var(--color-surface)] px-3 py-1.5 tabular-nums">
              {puzzle.rating} ± {puzzle.ratingDeviation}
            </span>
            {puzzle.themes.slice(0, 3).map((theme) => (
              <span
                key={theme}
                className="rounded-md bg-[var(--color-surface)] px-3 py-1.5 text-[var(--color-ink-muted)]"
              >
                {THEME_LABELS[theme] ?? theme}
              </span>
            ))}
          </div>
        )}

        <Card className="mt-6 p-5">
          {solved === null ? (
            <>
              <p className="text-sm text-[var(--color-ink-muted)]">
                {hint ?? 'Clique na peça e depois na casa de destino.'}
              </p>
              {moves.length > 0 && (
                <p className="mt-3 font-mono text-sm tabular-nums">
                  {solution.slice(0, moves.length).map((step) => step.san).join(' ')}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setHint('Dica: procure um lance de captura ou de sacrifício.');
                }}
              >
                <Icon name="puzzle" size={15} />
                Pedir dica
              </Button>
            </>
          ) : solved ? (
            <div>
              <p className="flex items-center gap-2 font-semibold text-[var(--color-success)]">
                <Icon name="check" size={18} />
                Resolvido
              </p>
              {rating !== null && (
                <p className="mt-1 text-sm tabular-nums text-[var(--color-ink-muted)]">
                  Rating de problemas: {rating}
                </p>
              )}
              <Button
                variant="primary"
                className="mt-4"
                onClick={() => {
                  setSolved(null);
                  setMoves([]);
                  setStep(0);
                  setSelected(null);
                  setHint(null);
                  void puzzleQuery.refetch();
                }}
              >
                Próximo problema
              </Button>
            </div>
          ) : (
            <div>
              <p className="flex items-center gap-2 font-semibold text-[var(--color-danger)]">
                <Icon name="close" size={18} />
                Não foi desta vez
              </p>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                Reveja a posição e tente de novo. O lance certo aparece depois da tentativa.
              </p>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => setSolved(null)}>
                  Tentar de novo
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setSolved(null);
                    setMoves([]);
                    setStep(0);
                    setSelected(null);
                    setHint(null);
                    void puzzleQuery.refetch();
                  }}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Button variant="ghost" className="mt-6" onClick={() => navigate('/play')}>
          <Icon name="arrow-left" size={16} />
          Voltar para jogar
        </Button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { formatDate, formatRating, ratingCategoryOf, RATING_LABELS } from '../lib/format.ts';
import { Avatar } from '../components/ui/Avatar.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { Tabs } from '../components/ui/Tabs.tsx';
import { Icon } from '../components/icons.tsx';

type Filter = 'all' | 'wins' | 'losses' | 'draws';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'wins', label: 'Vitórias' },
  { id: 'losses', label: 'Derrotas' },
  { id: 'draws', label: 'Empates' },
];

export default function GamesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['my-games', filter, page],
    queryFn: ({ signal }) => api.userGames(user?.username ?? '', page, signal),
    enabled: Boolean(user),
  });

  const items = (query.data?.items ?? []).filter((game) => {
    if (filter === 'all') return true;
    const won = game.color === 'w' ? game.result === '1-0' : game.result === '0-1';
    if (filter === 'wins') return won;
    if (filter === 'losses') return !won && game.result !== '1/2-1/2';
    return game.result === '1/2-1/2';
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1;

  if (!user) {
    return (
      <div className="mx-auto max-w-[62rem] px-5 py-14">
        <EmptyState
          icon={<Icon name="history" />}
          title="Entre para ver o seu histórico"
          description="Suas partidas ficam guardadas e prontas para análise."
          action={
            <Link
              to="/login"
              className="text-sm font-medium text-[var(--color-accent)] hover:underline underline-offset-4"
            >
              Entrar
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[62rem] px-5 py-10 lg:py-14">
      <h1 className="text-[2.1rem] font-bold tracking-[-0.02em]">Minhas partidas</h1>
      <p className="mt-2 text-[var(--color-ink-muted)]">
        Cada partida validada pelo servidor, com PGN disponível para análise.
      </p>

      <div className="mt-7">
        <Tabs value={filter} onChange={(value) => setFilter(value as Filter)} ariaLabel="Filtrar partidas">
          {FILTERS.map((item) => (
            <Tabs.Tab key={item.id} value={item.id}>
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg bg-[var(--color-surface)]">
        {query.isLoading ? (
          <div className="p-4">
            <Skeleton className="h-56 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Icon name="board" />}
              title={filter === 'all' ? 'Nenhuma partida ainda' : 'Nada com esse filtro'}
              description={
                filter === 'all'
                  ? 'Jogue a primeira partida e ela aparece aqui.'
                  : 'Tente outro filtro para ver mais resultados.'
              }
              action={
                filter === 'all' ? (
                  <Link
                    to="/play"
                    className="text-sm font-medium text-[var(--color-accent)] hover:underline underline-offset-4"
                  >
                    Jogar agora
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-hairline)]">
            {items.map((game) => {
              const won = game.color === 'w' ? game.result === '1-0' : game.result === '0-1';
              const draw = game.result === '1/2-1/2';
              const tone = draw
                ? 'text-[var(--color-ink-muted)]'
                : won
                  ? 'text-[var(--color-success)]'
                  : 'text-[var(--color-danger)]';
              return (
                <li key={game.id}>
                  <Link
                    to={`/game/${game.id}`}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--color-raised)]"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-sunken)] text-xs font-bold ${tone}`}
                    >
                      {draw ? 'E' : won ? 'V' : 'D'}
                    </span>
                    <Avatar seed={game.opponent.username} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{game.opponent.username}</span>
                      <span className="block text-xs text-[var(--color-ink-faint)]">
                        {RATING_LABELS[ratingCategoryOf(game.timeControl)]} · {game.timeControl} ·{' '}
                        {game.moves} lances · {formatDate(game.endedAt)}
                      </span>
                    </span>
                    <span className="hidden text-sm tabular-nums text-[var(--color-ink-muted)] sm:block">
                      {formatRating(game.opponent.rating)}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink-faint)]">
                      <Icon name="arrow-right" size={14} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {query.data && query.data.total > query.data.pageSize && (
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1}
            className="flex h-10 items-center gap-1.5 rounded-md px-3 text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] disabled:opacity-40"
          >
            <Icon name="arrow-left" size={16} />
            Anterior
          </button>
          <span className="text-sm tabular-nums text-[var(--color-ink-faint)]">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages}
            className="flex h-10 items-center gap-1.5 rounded-md px-3 text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] disabled:opacity-40"
          >
            Próxima
            <Icon name="arrow-right" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

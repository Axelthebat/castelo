import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { formatRating } from '../lib/format.ts';
import { RATING_LABELS, RATING_ORDER } from '../lib/format.ts';
import type { RatingCategory } from '@castelo/shared';
import { Avatar } from '../components/ui/Avatar.tsx';
import { Tabs } from '../components/ui/Tabs.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { Icon } from '../components/icons.tsx';

export default function LeaderboardPage() {
  const [category, setCategory] = useState<RatingCategory>('blitz');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['leaderboard', category, page],
    queryFn: ({ signal }) => api.leaderboard(category, page, signal),
  });

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-[62rem] px-5 py-10 lg:py-14">
      <h1 className="text-[2.1rem] font-bold tracking-[-0.02em]">Ranking</h1>
      <p className="mt-2 max-w-[36rem] text-[var(--color-ink-muted)]">
        Cada categoria tem o próprio rating. O número que importa é o do formato que você joga.
      </p>

      <div className="mt-8">
        <Tabs
          value={category}
          onChange={(value) => {
            setCategory(value as RatingCategory);
            setPage(1);
          }}
          ariaLabel="Categoria do ranking"
        >
          {RATING_ORDER.map((key) => (
            <Tabs.Tab key={key} value={key}>
              {RATING_LABELS[key]}
            </Tabs.Tab>
          ))}
        </Tabs>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg bg-[var(--color-surface)]">
        {query.isLoading ? (
          <ul className="divide-y divide-[var(--color-hairline)]">
            {Array.from({ length: 10 }).map((_, index) => (
              <li key={index} className="flex items-center gap-4 p-4">
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <div className="p-8">
            <EmptyState
              icon={<Icon name="chart" />}
              title="Não foi possível carregar o ranking"
              description="Verifique sua conexão e tente novamente."
              action={
                <button
                  type="button"
                  onClick={() => void query.refetch()}
                  className="text-sm font-medium text-[var(--color-accent)] hover:underline underline-offset-4"
                >
                  Tentar de novo
                </button>
              }
            />
          </div>
        ) : query.data && query.data.items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Icon name="trophy" />}
              title="Ranking vazio"
              description="Ninguém jogou nesta categoria ainda. Seja o primeiro."
              action={
                <Link
                  to="/play/online"
                  className="text-sm font-medium text-[var(--color-accent)] hover:underline underline-offset-4"
                >
                  Jogar agora
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-hairline)]">
            {query.data?.items.map((entry) => (
              <li key={entry.userId}>
                <Link
                  to={`/profile/${entry.username}`}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--color-raised)]"
                >
                  <span
                    className={`w-7 shrink-0 text-right font-semibold tabular-nums ${
                      entry.rank <= 3 ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-faint)]'
                    }`}
                  >
                    {entry.rank}
                  </span>
                  <Avatar seed={entry.username} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{entry.username}</span>
                    <span className="block text-xs text-[var(--color-ink-faint)] tabular-nums">
                      {entry.wins} V · {entry.losses} D · {entry.draws} E
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatRating(entry.rating)}</span>
                </Link>
              </li>
            ))}
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

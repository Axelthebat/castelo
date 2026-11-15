import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { formatDate, formatPercent, formatRating, RATING_LABELS, RATING_ORDER } from '../lib/format.ts';
import { Avatar } from '../components/ui/Avatar.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Icon } from '../components/icons.tsx';
import type { GameSummary } from '@castelo/shared';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-surface)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { username = '' } = useParams<{ username: string }>();

  const profile = useQuery({
    queryKey: ['profile', username],
    queryFn: ({ signal }) => api.profile(username, signal),
    enabled: username.length > 0,
  });

  const games = useQuery({
    queryKey: ['profile-games', username],
    queryFn: ({ signal }) => api.userGames(username, 1, signal),
    enabled: username.length > 0,
  });

  if (profile.isLoading) {
    return (
      <div className="mx-auto max-w-[62rem] px-5 py-12">
        <Skeleton className="h-28 w-28 rounded-full" />
        <Skeleton className="mt-5 h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-80" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div className="mx-auto max-w-[62rem] px-5 py-14">
        <EmptyState
          icon={<Icon name="user" />}
          title="Jogador não encontrado"
          description="Esse nome de usuário não existe ou o perfil está privado."
          action={
            <Link to="/play" className="text-sm font-medium text-[var(--color-accent)] hover:underline">
              Voltar para jogar
            </Link>
          }
        />
      </div>
    );
  }

  const user = profile.data;

  return (
    <div className="mx-auto max-w-[62rem] px-5 py-10 lg:py-14">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar seed={user.username} size={96} />
        <div className="min-w-0">
          <h1 className="text-[2rem] font-bold tracking-[-0.02em]">{user.username}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Membro desde {formatDate(user.createdAt)}
            {user.location ? ` · ${user.location}` : ''}
          </p>
          {user.bio && (
            <p className="mt-3 max-w-[36rem] leading-relaxed text-[var(--color-ink-muted)]">{user.bio}</p>
          )}
        </div>
      </header>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Partidas" value={String(user.totalGames)} />
        <StatTile label="Vitórias" value={formatPercent(user.winRate, 1)} />
        <StatTile label="Melhor sequência" value={String(user.bestStreak)} />
        <StatTile label="Rating pico" value={formatRating(user.peakRating)} />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Ratings</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {RATING_ORDER.map((category) => {
            const stats = user.stats[category];
            const total = stats.wins + stats.losses + stats.draws;
            const winRate = total > 0 ? stats.wins / total : 0;
            return (
              <Card key={category} className="p-5">
                <p className="text-sm text-[var(--color-ink-muted)]">{RATING_LABELS[category]}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                  {formatRating(user.ratings[category])}
                </p>
                <p className="mt-2 text-xs tabular-nums text-[var(--color-ink-faint)]">
                  {stats.wins}V · {stats.losses}D · {stats.draws}E · {formatPercent(winRate, 0)}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Partidas recentes</h2>
        <div className="mt-4 overflow-hidden rounded-lg bg-[var(--color-surface)]">
          {games.isLoading ? (
            <div className="p-4">
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !games.data || games.data.items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Icon name="history" />}
                title="Nenhuma partida registrada"
                description="Quando este jogador terminar um jogo, ele aparece aqui."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-hairline)]">
              {games.data.items.map((game: GameSummary) => (
                <li key={game.id}>
                  <Link
                    to={`/game/${game.id}`}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-[var(--color-raised)]"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                        game.result === '1/2-1/2'
                          ? 'bg-[var(--color-raised)] text-[var(--color-ink-muted)]'
                          : (game.color === 'w' ? game.result === '1-0' : game.result === '0-1')
                            ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
                            : 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
                      }`}
                    >
                      {game.result === '1/2-1/2' ? 'E' : (game.color === 'w' ? game.result === '1-0' : game.result === '0-1') ? 'V' : 'D'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">contra {game.opponent.username}</span>
                      <span className="block text-xs text-[var(--color-ink-faint)]">
                        {game.timeControl} · {game.moves} lances · {formatDate(game.endedAt)}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums text-[var(--color-ink-muted)]">
                      {formatRating(game.opponent.rating)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="mt-8 flex items-center gap-2 text-xs text-[var(--color-ink-faint)]">
        <Icon name="shield" size={14} />
        As estatísticas vêm das partidas validadas pelo servidor.
      </p>
    </div>
  );
}

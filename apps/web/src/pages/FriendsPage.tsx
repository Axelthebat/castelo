import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { formatRating, formatRelative } from '../lib/format.ts';
import { Avatar } from '../components/ui/Avatar.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { EmptyState } from '../components/ui/EmptyState.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { Icon } from '../components/icons.tsx';
import type { Friend } from '@castelo/shared';

export default function FriendsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const query = useQuery({
    queryKey: ['friends'],
    queryFn: ({ signal }) => api.friends(signal),
    enabled: Boolean(user),
  });

  const challenges = useQuery({
    queryKey: ['challenges'],
    queryFn: ({ signal }) => api.challenges(signal),
    enabled: Boolean(user),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['friends'] });
    void queryClient.invalidateQueries({ queryKey: ['challenges'] });
  };

  const acceptChallenge = useMutation({
    mutationFn: (id: string) => api.acceptChallenge(id),
    onSuccess: (result) => {
      invalidate();
      navigate(`/game/${result.gameId}`);
    },
  });

  const declineChallenge = useMutation({
    mutationFn: (id: string) => api.declineChallenge(id),
    onSuccess: invalidate,
  });

  const request = useMutation({
    mutationFn: (name: string) => api.requestFriend(name),
    onSuccess: () => {
      setFeedback({ tone: 'ok', text: 'Pedido enviado.' });
      setUsername('');
      invalidate();
    },
    onError: (error) =>
      setFeedback({
        tone: 'error',
        text: error instanceof ApiError ? error.message : 'Não foi possível enviar o pedido.',
      }),
  });

  const accept = useMutation({
    mutationFn: (id: string) => api.acceptFriend(id),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.removeFriend(id),
    onSuccess: invalidate,
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);
    request.mutate(username.trim());
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[62rem] px-5 py-14">
        <EmptyState
          icon={<Icon name="users" />}
          title="Entre para ver seus amigos"
          description="Desafie quem você joga e acompanhe o rating de cada um."
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

  const friends = query.data?.friends ?? [];
  const pendingIn = friends.filter((friend: Friend) => friend.status === 'pending_in');
  const pendingOut = friends.filter((friend: Friend) => friend.status === 'pending_out');
  const accepted = friends.filter((friend: Friend) => friend.status === 'friends');

  return (
    <div className="mx-auto max-w-[62rem] px-5 py-10 lg:py-14">
      <h1 className="text-[2.1rem] font-bold tracking-[-0.02em]">Amigos</h1>
      <p className="mt-2 max-w-[36rem] text-[var(--color-ink-muted)]">
        Busque um jogador pelo nome de usuário e convide para uma partida.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Nome de usuário"
            placeholder="ex.: magdalena"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="primary" loading={request.isPending} className="sm:mb-0">
          <Icon name="plus" size={16} />
          Adicionar
        </Button>
      </form>

      {feedback && (
        <p
          role="status"
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            feedback.tone === 'ok'
              ? 'bg-[var(--color-success)]/12 text-[var(--color-success)]'
              : 'bg-[var(--color-danger)]/12 text-[var(--color-danger)]'
          }`}
        >
          {feedback.text}
        </p>
      )}

      {query.isLoading ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {pendingIn.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-[var(--color-ink-muted)]">
                Pedidos recebidos ({pendingIn.length})
              </h2>
              <ul className="mt-3 divide-y divide-[var(--color-hairline)] overflow-hidden rounded-lg bg-[var(--color-surface)]"> {/* taste-skill-ignore: linhas de dados/tabela */}
                {pendingIn.map((friend: Friend) => (
                  <li key={friend.id} className="flex items-center gap-4 p-4">
                    <Avatar seed={friend.username} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{friend.username}</span>
                      <span className="block text-xs tabular-nums text-[var(--color-ink-faint)]">
                        {formatRating(friend.rating)}
                      </span>
                    </span>
                    <Button size="sm" variant="primary" onClick={() => accept.mutate(friend.id)}>
                      Aceitar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(friend.id)}>
                      Recusar
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {challenges.data && challenges.data.challenges.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-[var(--color-ink-muted)]">
                Convites recebidos ({challenges.data.challenges.length})
              </h2>
              <ul className="mt-3 divide-y divide-[var(--color-hairline)] overflow-hidden rounded-lg bg-[var(--color-surface)]"> {/* taste-skill-ignore: linhas de dados/tabela */}
                {challenges.data.challenges.map((challenge) => (
                  <li key={challenge.id} className="flex items-center gap-4 p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-sunken)] text-[var(--color-accent)]">
                      <Icon name="knight" size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {challenge.toId === user.id ? 'Você foi desafiado' : 'Convite enviado'}
                      </span>
                      <span className="block text-xs tabular-nums text-[var(--color-ink-faint)]">
                        {challenge.timeControl} · {new Date(challenge.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </span>
                    {challenge.toId === user.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => acceptChallenge.mutate(challenge.id)}
                        >
                          Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => declineChallenge.mutate(challenge.id)}
                        >
                          Recusar
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--color-ink-faint)]">Aguardando resposta</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-sm font-medium text-[var(--color-ink-muted)]">
              Meus amigos ({accepted.length})
            </h2>
            {accepted.length === 0 ? (
              <div className="mt-3 rounded-lg bg-[var(--color-surface)] p-8">
                <EmptyState
                  icon={<Icon name="users" />}
                  title="Nenhum amigo ainda"
                  description="Busque um jogador pelo nome de usuário acima e envie o primeiro pedido."
                />
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--color-hairline)] overflow-hidden rounded-lg bg-[var(--color-surface)]"> {/* taste-skill-ignore: linhas de dados/tabela */}
                {accepted.map((friend: Friend) => (
                  <li key={friend.id} className="flex items-center gap-4 p-4">
                    <Avatar seed={friend.username} size={40} />
                    <span className="min-w-0 flex-1">
                      <Link
                        to={`/profile/${friend.username}`}
                        className="block truncate font-medium hover:underline underline-offset-4"
                      >
                        {friend.username}
                      </Link>
                      <span className="block text-xs tabular-nums text-[var(--color-ink-faint)]">
                        {formatRating(friend.rating)}
                        {friend.lastSeenAt ? ` · visto ${formatRelative(friend.lastSeenAt)}` : ''}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void api
                          .challenge(friend.username, '10+5')
                          .then(() => setFeedback({ tone: 'ok', text: `Convite enviado para ${friend.username}.` }))
                          .catch((error) =>
                            setFeedback({
                              tone: 'error',
                              text:
                                error instanceof ApiError
                                  ? error.message
                                  : 'Não foi possível enviar o convite.',
                            }),
                          )
                      }
                    >
                      <Icon name="send" size={15} />
                      Desafiar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(friend.id)}>
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pendingOut.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-[var(--color-ink-muted)]">
                Pedidos enviados ({pendingOut.length})
              </h2>
              <ul className="mt-3 divide-y divide-[var(--color-hairline)] overflow-hidden rounded-lg bg-[var(--color-surface)]"> {/* taste-skill-ignore: linhas de dados/tabela */}
                {pendingOut.map((friend: Friend) => (
                  <li key={friend.id} className="flex items-center gap-4 p-4">
                    <Avatar seed={friend.username} size={40} />
                    <span className="min-w-0 flex-1 truncate font-medium">{friend.username}</span>
                    <span className="text-xs text-[var(--color-ink-faint)]">Aguardando resposta</span>
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(friend.id)}>
                      Cancelar
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

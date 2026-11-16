import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { getSocket, type SocketStatus } from '../lib/socket.ts';
import { TIME_CONTROLS, findTimeControl } from '../lib/constants.ts';
import { formatRating, RATING_LABELS, ratingCategoryOf } from '../lib/format.ts';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Icon } from '../components/icons.tsx';
import type { ServerMessage } from '@castelo/shared';

type Phase = 'idle' | 'queued' | 'error';

export default function OnlinePlayPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [timeControl, setTimeControl] = useState('10+5');
  const [phase, setPhase] = useState<Phase>('idle');
  const [position, setPosition] = useState(0);
  const [status, setStatus] = useState<SocketStatus>('closed');
  const [message, setMessage] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: ({ signal }) => api.settings(signal),
    enabled: Boolean(user),
  });

  const option = findTimeControl(timeControl);
  const category = ratingCategoryOf(timeControl);
  const myRating = user?.ratings[category] ?? 1200;

  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    const offStatus = socket.onStatus(setStatus);

    const offMessage = socket.on((event: ServerMessage) => {
      if (event.type === 'queue:waiting') {
        setPosition(event.position);
        setPhase('queued');
      } else if (event.type === 'queue:matched') {
        navigate(`/game/${event.gameId}`);
      } else if (event.type === 'queue:left') {
        setPhase('idle');
      } else if (event.type === 'error') {
        setMessage(event.message);
        setPhase('error');
      }
    });

    return () => {
      offStatus();
      offMessage();
    };
  }, [navigate]);

  useEffect(() => {
    if (settings.data?.defaultTimeControl) {
      setTimeControl(settings.data.defaultTimeControl);
    }
  }, [settings.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof TIME_CONTROLS>();
    for (const item of TIME_CONTROLS) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, []);

  function joinQueue() {
    setMessage(null);
    setPhase('queued');
    getSocket().send({ type: 'queue:join', timeControl });
  }

  function leaveQueue() {
    getSocket().send({ type: 'queue:leave' });
    setPhase('idle');
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-[52rem] px-5 py-14">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Entre para jogar online</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            A fila te pareia com alguém do mesmo nível. Precisa de conta.
          </p>
          <Button to="/register" variant="primary" className="mt-6">
            Criar conta
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[52rem] px-5 py-10 lg:py-14">
      <h1 className="text-[2.1rem] font-bold tracking-[-0.02em]">Jogar online</h1>
      <p className="mt-2 max-w-[38rem] text-[var(--color-ink-muted)]">
        Escolha o formato. O pareamento busca alguém dentro de 200 pontos de rating no mesmo
        formato.
      </p>

      {phase === 'queued' ? (
        <div className="mt-9">
          <Card className="flex flex-col items-center gap-5 p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-raised)] text-[var(--color-accent)]">
              <Icon name="users" size={26} />
            </span>
            <div>
              <p className="text-xl font-semibold tracking-tight">
                Procurando um adversário
              </p>
              <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                {option?.label} · posição {Math.max(1, position)} na fila
              </p>
            </div>
            <div
              className="h-1 w-40 overflow-hidden rounded-full bg-[var(--color-raised)]"
              role="progressbar"
              aria-label="Buscando adversário"
            >
              <span className="block h-full w-1/3 animate-[pulse_1.4s_ease-in-out_infinite] bg-[var(--color-accent)]" />
            </div>
            <Button variant="secondary" onClick={leaveQueue}>
              Sair da fila
            </Button>
          </Card>
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-6">
            {grouped.map(([categoryId, options]) => (
              <section key={categoryId}>
                <h2 className="text-sm font-medium text-[var(--color-ink-muted)]">
                  {RATING_LABELS[categoryId as keyof typeof RATING_LABELS]}
                </h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {options.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTimeControl(item.id)}
                      aria-pressed={timeControl === item.id}
                      className={`rounded-md px-4 py-3 text-left transition-colors ${
                        timeControl === item.id
                          ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                          : 'bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-raised)]'
                      }`}
                    >
                      <span className="block font-medium">{item.label}</span>
                      <span
                        className={`mt-0.5 block text-xs tabular-nums ${
                          timeControl === item.id
                            ? 'text-[var(--color-accent-ink)]/70'
                            : 'text-[var(--color-ink-faint)]'
                        }`}
                      >
                        {item.increment > 0 ? `+${item.increment}s por lance` : 'sem incremento'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <Card className="mt-8 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--color-ink-muted)]">Seu rating em {RATING_LABELS[category]}</p>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">{formatRating(myRating)}</p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={joinQueue}
              disabled={status !== 'open'}
            >
              <Icon name="users" size={18} />
              {status === 'open' ? 'Entrar na fila' : 'Conectando…'}
            </Button>
          </Card>

          {message && (
            <p
              role="alert"
              className="mt-4 rounded-md bg-[var(--color-danger)]/12 px-3 py-2 text-sm text-[var(--color-danger)]"
            >
              {message}
            </p>
          )}
        </>
      )}
    </div>
  );
}

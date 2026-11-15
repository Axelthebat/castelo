import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api.ts';
import { useAuth } from '../lib/auth.tsx';
import { BOT_DIFFICULTIES, TIME_CONTROLS } from '../lib/constants.ts';
import { Button } from '../components/ui/Button.tsx';
import { Card } from '../components/ui/Card.tsx';
import { Icon } from '../components/icons.tsx';

export default function BotPlayPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [difficulty, setDifficulty] = useState<string>('casual');
  const [timeControl, setTimeControl] = useState('10+5');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.createBotGame(timeControl, difficulty),
    onSuccess: (result) => navigate(`/game/${result.gameId}`),
    onError: (cause) =>
      setError(
        cause instanceof ApiError ? cause.message : 'Não foi possível iniciar a partida contra o bot.',
      ),
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-[52rem] px-5 py-14">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Entre para enfrentar o bot</h1>
          <p className="mt-2 text-[var(--color-ink-muted)]">
            As partidas contra o bot também contam para o seu histórico e rating.
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
      <h1 className="text-[2.1rem] font-bold tracking-[-0.02em]">Enfrentar o bot</h1>
      <p className="mt-2 max-w-[38rem] text-[var(--color-ink-muted)]">
        O bot roda no servidor com busca alfa-beta de verdade — não é um lance aleatório.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-[var(--color-ink-muted)]">Nível</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {BOT_DIFFICULTIES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDifficulty(item.id)}
              aria-pressed={difficulty === item.id}
              className={`rounded-md px-4 py-3 text-left transition-colors ${
                difficulty === item.id
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                  : 'bg-[var(--color-surface)] hover:bg-[var(--color-raised)]'
              }`}
            >
              <span className="block font-medium">{item.label}</span>
              <span
                className={`mt-0.5 block text-xs ${
                  difficulty === item.id
                    ? 'text-[var(--color-accent-ink)]/70'
                    : 'text-[var(--color-ink-faint)]'
                }`}
              >
                {item.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-sm font-medium text-[var(--color-ink-muted)]">Tempo de jogo</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {TIME_CONTROLS.filter((item) => item.base >= 180).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTimeControl(item.id)}
              aria-pressed={timeControl === item.id}
              className={`rounded-md px-4 py-3 text-left transition-colors ${
                timeControl === item.id
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                  : 'bg-[var(--color-surface)] hover:bg-[var(--color-raised)]'
              }`}
            >
              <span className="block font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-md bg-[var(--color-danger)]/12 px-3 py-2 text-sm text-[var(--color-danger)]"
        >
          {error}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="mt-8"
        loading={create.isPending}
        onClick={() => create.mutate()}
      >
        <Icon name="bot" size={18} />
        Começar partida
      </Button>
    </div>
  );
}

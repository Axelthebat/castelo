import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/icons.tsx';
import { Card } from '../components/ui/Card.tsx';

interface Option {
  to: string;
  title: string;
  description: string;
  icon: IconName;
  cta: string;
}

const OPTIONS: Option[] = [
  {
    to: '/play/online',
    title: 'Jogar online',
    description: 'Encontre alguém do seu nível em bullet, blitz, rapid ou clássico.',
    icon: 'users',
    cta: 'Entrar na fila',
  },
  {
    to: '/play/bot',
    title: 'Enfrentar o bot',
    description: 'Do aprendiz que erra até o mestre que castiga.',
    icon: 'bot',
    cta: 'Escolher nível',
  },
  {
    to: '/puzzles',
    title: 'Treinar tática',
    description: 'Posições curtas para treinar o cálculo.',
    icon: 'target',
    cta: 'Resolver problemas',
  },
  {
    to: '/friends',
    title: 'Desafiar um amigo',
    description: 'Mande um convite com o tempo de jogo que você quer.',
    icon: 'send',
    cta: 'Ver amigos',
  },
];

export default function PlayPage() {
  return (
    <div className="mx-auto max-w-[70rem] px-5 py-10 lg:py-14">
      <h1 className="text-[2.1rem] font-bold tracking-[-0.02em]">Jogar</h1>
      <p className="mt-2 max-w-[36rem] text-[var(--color-ink-muted)]">
        As regras são aplicadas no servidor. O resultado de uma partida nunca depende do
        navegador.
      </p>

      <div className="mt-9 grid gap-3 md:grid-cols-2">
        {OPTIONS.map((option) => (
          <Card key={option.to} className="flex flex-col gap-5 p-6">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--color-sunken)] text-[var(--color-accent)]">
                <Icon name={option.icon} size={22} />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{option.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
                  {option.description}
                </p>
              </div>
            </div>
            <Link
              to={option.to}
              className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:underline underline-offset-4"
            >
              {option.cta}
              <Icon name="arrow-right" size={15} />
            </Link>
          </Card>
        ))}
      </div>

      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        <Link
          to="/games"
          className="flex items-center gap-4 rounded-lg bg-[var(--color-surface)] p-5 transition-colors hover:bg-[var(--color-raised)]"
        >
          <span className="text-[var(--color-accent)]">
            <Icon name="history" size={22} />
          </span>
          <span>
            <span className="block font-medium">Histórico de partidas</span>
            <span className="block text-sm text-[var(--color-ink-muted)]">
              Reveja qualquer lance do seu histórico
            </span>
          </span>
        </Link>
        <Link
          to="/leaderboard"
          className="flex items-center gap-4 rounded-lg bg-[var(--color-surface)] p-5 transition-colors hover:bg-[var(--color-raised)]"
        >
          <span className="text-[var(--color-accent)]">
            <Icon name="trophy" size={22} />
          </span>
          <span>
            <span className="block font-medium">Ranking</span>
            <span className="block text-sm text-[var(--color-ink-muted)]">
              Os melhores jogadores por categoria
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}

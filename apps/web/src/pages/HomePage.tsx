import { Link } from 'react-router-dom';
import { DemoBoard } from '../components/demo/DemoBoard.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Icon, type IconName } from '../components/icons.tsx';
import { useAuth } from '../lib/auth.tsx';

interface PlayOption {
  to: string;
  title: string;
  description: string;
  icon: IconName;
  span: string;
}

const PLAY_OPTIONS: PlayOption[] = [
  {
    to: '/play/online',
    title: 'Jogar online',
    description: 'Entramos na fila e te pareamos com alguém do seu nível, no formato que você escolher.',
    icon: 'users',
    span: 'lg:col-span-7 lg:row-span-2',
  },
  {
    to: '/play/bot',
    title: 'Contra o bot',
    description: 'Quatro níveis, do aprendiz que erra até o mestre que castiga.',
    icon: 'bot',
    span: 'lg:col-span-5',
  },
  {
    to: '/puzzles',
    title: 'Problemas',
    description: 'Posições táticas para treinar todos os dias.',
    icon: 'target',
    span: 'lg:col-span-5',
  },
  {
    to: '/games',
    title: 'Analisar partidas',
    description: 'Revise qualquer lance do seu histórico em PGN.',
    icon: 'history',
    span: 'lg:col-span-5',
  },
];

const PRINCIPLES = [
  {
    title: 'Relógio que faz sentido',
    body: 'Escolha bullet, blitz, rapid ou clássico. O incremento entra depois de cada lance, então recuperar tempo na sequência é decisão sua — não sorte.',
  },
  {
    title: 'Histórico que se explica',
    body: 'Cada partida vira PGN. Reabra qualquer lance, veja o FEN resultante e descubra onde o jogo virou.',
  },
  {
    title: 'Rating por formato',
    body: 'Bullet, blitz, rapid e clássico têm ratings separados. O número que importa é o do formato que você realmente joga.',
  },
  {
    title: 'Nada de resultado inventado',
    body: 'O servidor aplica as regras, valida cada lance e decide o fim da partida. O navegador só desenha o tabuleiro.',
  },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto grid max-w-[76rem] items-center gap-10 px-5 py-14 lg:grid-cols-12 lg:gap-12 lg:py-20">
        <div className="lg:col-span-5">
          <h1 className="text-[2.6rem] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[3.4rem] lg:text-[3.6rem]">
            Xadrez online, sem enrolação
          </h1>
          <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-relaxed text-[var(--color-ink-muted)]">
            Partidas rápidas, relógio justo e histórico completo para revisar cada lance. O
            tabuleiro ao lado é real: clique numa peça e mova.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {user ? (
              <Button to="/play" variant="primary" size="lg">
                Ir para jogar
              </Button>
            ) : (
              <>
                <Button to="/register" variant="primary" size="lg">
                  Criar conta grátis
                </Button>
                <Button to="/login" variant="secondary" size="lg">
                  Já tenho conta
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          <DemoBoard />
        </div>
      </section>

      {/* Formas de jogar */}
      <section className="mx-auto max-w-[76rem] px-5 pb-16 lg:pb-24">
        <h2 className="text-[1.9rem] font-bold tracking-[-0.02em] sm:text-[2.3rem]">
          Quatro jeitos de jogar
        </h2>
        <p className="mt-2 max-w-[40rem] text-[var(--color-ink-muted)]">
          Escolha por onde começar. As outras opções continuam aqui.
        </p>

        <div className="mt-8 grid gap-3 lg:grid-cols-12">
          {PLAY_OPTIONS.map((option) => (
            <Link
              key={option.to}
              to={option.to}
              className={`group flex flex-col justify-between gap-6 rounded-lg bg-[var(--color-surface)] p-6 transition-colors hover:bg-[var(--color-raised)] ${option.span}`}
            >
              <div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[var(--color-sunken)] text-[var(--color-accent)]">
                  <Icon name={option.icon} size={22} />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{option.title}</h3>
                <p className="mt-2 max-w-[30rem] text-[var(--color-ink-muted)]">{option.description}</p>
              </div>
              <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]">
                Abrir
                <Icon
                  name="arrow-right"
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Princípios */}
      <section className="bg-[var(--color-surface)]">
        <div className="mx-auto max-w-[76rem] px-5 py-16 lg:py-24">
          <h2 className="max-w-[30rem] text-[1.9rem] font-bold tracking-[-0.02em] sm:text-[2.3rem]">
            Feito para o seu ritmo
          </h2>
          <dl className="mt-10">
            {PRINCIPLES.map((item, index) => (
              <div
                key={item.title}
                className={`grid gap-2 py-6 lg:grid-cols-12 lg:gap-8 ${index > 0 ? 'border-t border-[var(--color-hairline)]' : ''}`}
              >
                <dt className="text-lg font-semibold tracking-tight lg:col-span-4">{item.title}</dt>
                <dd className="max-w-[44rem] leading-relaxed text-[var(--color-ink-muted)] lg:col-span-8">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[var(--color-accent)]">
        <div className="mx-auto flex max-w-[76rem] flex-col items-start gap-6 px-5 py-14 lg:flex-row lg:items-center lg:justify-between lg:py-16">
          <h2 className="max-w-[26rem] text-[1.9rem] font-bold leading-tight tracking-[-0.02em] text-[var(--color-accent-ink)] sm:text-[2.3rem]">
            Pronto para a primeira partida?
          </h2>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <Button to="/play" variant="secondary" size="lg">
                Jogar agora
              </Button>
            ) : (
              <>
                <Button
                  to="/register"
                  variant="secondary"
                  size="lg"
                  className="!bg-[var(--color-accent-ink)] !text-[var(--color-accent)]"
                >
                  Criar conta grátis
                </Button>
                <Button
                  to="/login"
                  variant="ghost"
                  size="lg"
                  className="!text-[var(--color-accent-ink)] hover:!bg-[var(--color-accent-ink)]/10"
                >
                  Entrar
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="bg-[var(--color-ground)]">
        <div className="mx-auto max-w-[76rem] px-5 py-12">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div className="max-w-[22rem]">
              <span className="text-lg font-bold tracking-tight">Castelo</span>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-faint)]">
                Plataforma de xadrez open source. Sem anúncios, sem rastreamento, e com as
                regras aplicadas no servidor.
              </p>
            </div>
            <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
              <Link to="/play" className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                Jogar
              </Link>
              <Link to="/puzzles" className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                Problemas
              </Link>
              <Link to="/leaderboard" className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                Ranking
              </Link>
              <Link to="/games" className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                Minhas partidas
              </Link>
              <Link to="/settings" className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                Configurações
              </Link>
              <Link to="/friends" className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                Amigos
              </Link>
            </nav>
          </div>
          <p className="mt-10 text-xs text-[var(--color-ink-faint)]">
            © {new Date().getFullYear()} Castelo. Projeto independente, sem vínculo com Chess.com.
          </p>
        </div>
      </footer>
    </div>
  );
}

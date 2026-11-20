import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Position } from '@castelo/engine';
import { ChessBoard } from '../components/board/ChessBoard.tsx';
import { Button } from '../components/ui/Button.tsx';
import { Icon } from '../components/icons.tsx';

interface Lesson {
  id: string;
  name: string;
  eco: string;
  description: string;
  idea: string;
  sans: string[];
  notes: Record<number, string>;
}

const LESSONS: Lesson[] = [
  {
    id: 'italiana',
    name: 'Abertura Italiana',
    eco: 'C50',
    description: 'A abertura clássica: desenvolva as peças e dispute o centro.',
    idea: 'Bispos em c4 e c5 atacam f7 e f2, os pontos mais frágeis nas primeiras jogadas.',
    sans: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+', 'Nc3'],
    notes: {
      0: 'O peão de e4 ocupa o centro e abre linhas para a dama e o bispo.',
      2: 'O cavalo ataca e5 e prepara o roque.',
      4: 'O bispo em c4 mira f7, defendido apenas pelo rei.',
      6: 'c3 prepara d4 para montar um centro amplo.',
      8: 'd4 disputa o centro. O peão de c3 sustenta o avanço.',
      11: 'Bb4+ incomoda o desenvolvimento; Nc3 bloqueia com tempo.',
    },
  },
  {
    id: 'siciliana',
    name: 'Defesa Siciliana',
    eco: 'B20',
    description: 'Responda a 1.e4 com 1...c5 e crie desequilíbrio desde o primeiro lance.',
    idea: 'As pretas controlam d4 pelo flanco, trocando o peão central por um peão lateral.',
    sans: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
    notes: {
      1: 'c5 controla d4 sem ocupar o centro — a ideia da Siciliana.',
      3: 'd6 prepara o desenvolvimento do bispo e protege e5.',
      4: 'As brancas abrem o centro para explorar a vantagem de espaço.',
      7: 'Nf6 ataca e4 e desenvolve com tempo.',
      9: 'a6 prepara b5 e impede Bb5, uma jogada comum das brancas.',
    },
  },
  {
    id: 'dama',
    name: 'Gambito da Dama',
    eco: 'D06',
    description: 'Ofereça o peão de c4 para desviar o centro adversário.',
    idea: 'O peão em c4 atrai o peão de d5, permitindo atacar o centro com o cavalo em c3.',
    sans: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O'],
    notes: {
      0: 'd4 ocupa o centro e abre a diagonal da dama.',
      2: 'O gambito: c4 desafia o peão de d5.',
      3: 'e6 sustenta d5, mas fecha o bispo de c8.',
      6: 'Bg5 fixa o cavalo de f6, ligado à defesa do rei.',
      9: 'As pretas colocam o rei em segurança e conectam as torres.',
    },
  },
  {
    id: 'carokann',
    name: 'Defesa Caro-Kann',
    eco: 'B12',
    description: 'Uma defesa sólida contra 1.e4, com o bispo em g6 fora da cadeia de peões.',
    idea: 'O peão em c6 apoia d5 sem prender o bispo de luz, ao contrário da Francesa.',
    sans: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6'],
    notes: {
      1: 'c6 prepara d5 com o apoio de um peão lateral.',
      3: 'd5 neutraliza o centro das brancas.',
      5: 'A troca em e4 abre a diagonal para o bispo de c8.',
      7: 'Bf5 desenvolve o bispo antes de fechar a posição.',
      9: 'Bg6 mantém o bispo ativo após Ng3.',
    },
  },
];

function positionsOf(sans: string[]): string[] {
  const position = new Position();
  const fens = [position.fen()];
  for (const san of sans) {
    position.moveSan(san);
    fens.push(position.fen());
  }
  return fens;
}

export default function LearnPage() {
  const [lessonId, setLessonId] = useState(LESSONS[0].id);
  const [ply, setPly] = useState(0);

  const lesson = LESSONS.find((item) => item.id === lessonId) ?? LESSONS[0];
  const fens = useMemo(() => positionsOf(lesson.sans), [lesson]);

  function chooseLesson(id: string) {
    setLessonId(id);
    setPly(0);
  }

  const note = lesson.notes[ply - 1];

  return (
    <div className="mx-auto max-w-[76rem] px-5 py-10 lg:py-14">
      <h1 className="text-[2.1rem] font-bold tracking-[-0.02em]">Estudos</h1>
      <p className="mt-2 max-w-[40rem] text-[var(--color-ink-muted)]">
        Quatro aberturas jogadas lance a lance. Cada posição vem de uma linha legal verificada —
        avance, leia a ideia e depois teste contra o bot.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[15rem_minmax(0,26rem)_1fr] lg:items-start">
        <nav aria-label="Aberturas" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {LESSONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => chooseLesson(item.id)}
              aria-pressed={item.id === lessonId}
              className={`shrink-0 rounded-md px-4 py-3 text-left transition-colors ${
                item.id === lessonId
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                  : 'bg-[var(--color-surface)] hover:bg-[var(--color-raised)]'
              }`}
            >
              <span className="block text-xs tabular-nums opacity-70">{item.eco}</span>
              <span className="block font-medium">{item.name}</span>
            </button>
          ))}
        </nav>

        <div>
          <ChessBoard
            fen={fens[ply]}
            orientation="w"
            showCoordinates
            showLegalMoves={false}
            animateMoves
            theme="walnut"
            ariaLabel={`${lesson.name}, lance ${ply} de ${lesson.sans.length}`}
          />
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-[var(--color-surface)] p-2">
            <Button variant="ghost" size="sm" onClick={() => setPly(0)} disabled={ply === 0} aria-label="Primeiro lance">
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
              {ply} / {lesson.sans.length}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPly((value) => Math.min(lesson.sans.length, value + 1))}
              disabled={ply === lesson.sans.length}
              aria-label="Próximo lance"
            >
              <Icon name="arrow-right" size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPly(lesson.sans.length)}
              disabled={ply === lesson.sans.length}
              aria-label="Último lance"
            >
              <Icon name="arrow-right" size={16} />
              <Icon name="arrow-right" size={16} />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-[var(--color-surface)] p-5">
            <p className="text-xs tabular-nums text-[var(--color-accent)]">{lesson.eco}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{lesson.name}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {lesson.description}
            </p>
          </div>

          <div className="rounded-lg bg-[var(--color-surface)] p-5" aria-live="polite">
            <p className="text-sm font-medium">
              {ply === 0 ? 'A ideia' : `Lance ${ply}: ${lesson.sans[ply - 1]}`}
            </p>
            <p key={ply} className="lesson-note mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {note ?? lesson.idea}
            </p>
          </div>

          <div className="rounded-lg bg-[var(--color-surface)] p-5">
            <p className="mb-2 text-sm font-medium">Sequência</p>
            <p className="font-[var(--font-display)] tabular-nums text-xs leading-relaxed text-[var(--color-ink-muted)]">
              {lesson.sans.join(' ')}
            </p>
          </div>

          <Button to="/play/bot" variant="primary">
            Testar contra o bot
            <Icon name="arrow-right" size={16} />
          </Button>
        </div>
      </div>

      <p className="mt-8 text-sm text-[var(--color-ink-muted)]">
        Quer treinar tática pura?{' '}
        <Link to="/puzzles" className="text-[var(--color-accent)] underline-offset-4 hover:underline">
          Resolver problemas
        </Link>
      </p>
    </div>
  );
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { Board } from '../src/board.ts';

/**
 * O gerador de lances do bot é uma implementação própria, para ser rápido
 * o bastante para a busca. Estes testes comparam a contagem de nós (perft)
 * com o chess.js, que é a referência de regras do projeto.
 */
const POSITIONS: { name: string; fen: string; depths: number[] }[] = [
  {
    name: 'posição inicial',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    depths: [1, 2, 3, 4],
  },
  {
    name: 'kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    depths: [1, 2, 3],
  },
  {
    name: 'final de peões',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    depths: [1, 2, 3, 4],
  },
  {
    name: 'promoções',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    depths: [1, 2, 3],
  },
  {
    name: 'posição 5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    depths: [1, 2, 3],
  },
  {
    name: 'posição 6',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    depths: [1, 2, 3],
  },
];

for (const position of POSITIONS) {
  for (const depth of position.depths) {
    test(`perft ${position.name} (profundidade ${depth})`, () => {
      const mine = new Board(position.fen).perft(depth);
      const reference = new Chess(position.fen).perft(depth);
      assert.equal(mine, reference);
    });
  }
}

const square = (index: number): string =>
  'abcdefgh'[index & 7] + String((index >> 3) + 1);

const PROMOTION_NAME: Record<number, string> = { 2: 'n', 3: 'b', 4: 'r', 5: 'q' };

test('os lances legais batem com o chess.js', () => {
  for (const position of POSITIONS) {
    const board = new Board(position.fen);
    const mine = board
      .generateLegal([])
      .map(
        (move) =>
          `${square(move.from)}${square(move.to)}${move.promotion ? PROMOTION_NAME[move.promotion] : ''}`,
      )
      .sort();
    const reference = new Chess(position.fen)
      .moves({ verbose: true })
      .map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
      .sort();
    assert.deepEqual(mine, reference, position.name);
  }
});

test('o hash muda a cada lance e volta ao estado anterior', () => {
  const board = new Board('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const before = `${board.hashHi}:${board.hashLo}`;
  const moves = board.generateLegal([]);
  // e2 = linha 1, coluna 4 => índice 12; e4 => índice 28.
  const move = moves.find((candidate) => candidate.from === 12 && candidate.to === 28);
  assert.ok(move, 'e2-e4 deve existir');
  board.makeMove(move);
  assert.notEqual(`${board.hashHi}:${board.hashLo}`, before);
  board.unmakeMove();
  assert.equal(`${board.hashHi}:${board.hashLo}`, before);
});

test('make/unmake restaura o tabuleiro', () => {
  const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
  const board = new Board(fen);
  const snapshot = Array.from(board.squares);
  const moves = board.generateLegal([]);
  for (const move of moves) {
    board.makeMove(move);
    board.unmakeMove();
    assert.deepEqual(Array.from(board.squares), snapshot);
  }
});

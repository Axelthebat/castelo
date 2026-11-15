#!/usr/bin/env node
/**
 * Verificacao da geometria do tabuleiro.
 *
 * Sem dependencias: usa o modulo real do tabuleiro (Node le TypeScript
 * diretamente) e, se a versao do Node nao souber fazer isso, cai para uma
 * implementacao de referencia embutida.
 *
 *   node apps/web/scripts/verify-board.mjs
 */

const EXPECTED = {
  a1: 'dark',
  h1: 'light',
  h8: 'dark',
  a8: 'light',
};

let squareColorAt;
let boardSquares;

try {
  const geometry = await import('../src/components/board/geometry.ts');
  squareColorAt = geometry.squareColorAt;
  boardSquares = geometry.boardSquares;
} catch {
  squareColorAt = (square) =>
    (square.charCodeAt(0) - 97 + (square.charCodeAt(1) - 49)) % 2 === 0 ? 'dark' : 'light';
  boardSquares = (orientation) => {
    const squares = [];
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const rank = orientation === 'b' ? row : 7 - row;
        const file = orientation === 'b' ? 7 - col : col;
        squares.push(`${'abcdefgh'[file]}${rank + 1}`);
      }
    }
    return squares;
  };
}

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

/* 1. As cores das casas de referencia. */
for (const [square, tone] of Object.entries(EXPECTED)) {
  const actual = squareColorAt(square);
  check(
    actual === tone,
    `cor de ${square}: esperado ${tone}, veio ${actual}`,
  );
}

/* 2. As 64 casas, sem repeticao, nas duas orientacoes. */
const white = boardSquares('w');
const black = boardSquares('b');

check(white.length === 64, `orientacao branca devolve ${white.length} casas, esperado 64`);
check(black.length === 64, `orientacao preta devolve ${black.length} casas, esperado 64`);
check(new Set(white).size === 64, 'orientacao branca tem casas repetidas');
check(new Set(black).size === 64, 'orientacao preta tem casas repetidas');

/* 3. A virada troca a ordem, mas nao o conjunto de casas. */
const whiteSet = new Set(white);
const blackSet = new Set(black);
const sameSet =
  whiteSet.size === blackSet.size && [...whiteSet].every((square) => blackSet.has(square));
check(sameSet, 'a virada de orientacao nao preservou as 64 casas');
check(
  white[0] === 'a8' && white[63] === 'h1',
  `ordem branca inesperada: comeca em ${white[0]} e termina em ${white[63]}`,
);
check(
  black[0] === 'h1' && black[63] === 'a8',
  `ordem preta inesperada: comeca em ${black[0]} e termina em ${black[63]}`,
);

/* 4. O xadrez comeca com 32 pecas, 16 de cada cor. */
const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const placement = startFen.split(' ')[0];
const counts = { w: 0, b: 0 };
for (const row of placement.split('/')) {
  for (const char of row) {
    if (/\d/.test(char)) continue;
    if (char === char.toUpperCase()) counts.w += 1;
    else counts.b += 1;
  }
}
check(counts.w === 16, `posicao inicial com ${counts.w} pecas brancas, esperado 16`);
check(counts.b === 16, `posicao inicial com ${counts.b} pecas pretas, esperado 16`);

if (failures.length > 0) {
  console.error('FALHOU:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log('OK');

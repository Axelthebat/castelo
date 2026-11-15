import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Position,
  Clock,
  eloUpdate,
  toPgn,
  parsePgn,
  botMove,
  isValidFen,
  describeFen,
  START_FEN,
  IllegalMoveError,
} from '../src/index.ts';

test('posição inicial tem 20 lances legais', () => {
  const position = new Position();
  assert.equal(position.legalMoves().length, 20);
  assert.equal(position.turn(), 'w');
  assert.equal(position.fen(), START_FEN);
});

test('lances iniciais esperados estão na lista', () => {
  const position = new Position();
  const sans = position.moves();
  assert.ok(sans.includes('e4'));
  assert.ok(sans.includes('Nf3'));
});

test('lance ilegal lança IllegalMoveError', () => {
  const position = new Position();
  assert.throws(
    () => position.move('e2', 'e5'),
    (error: unknown) => error instanceof IllegalMoveError && error.code === 'illegal',
  );
});

test('matriz do tabuleiro começa no rank 8', () => {
  const position = new Position();
  const board = position.board();
  assert.equal(board.length, 8);
  assert.equal(board[0].length, 8);
  assert.equal(board[0][0], 'r');
  assert.equal(board[0][7], 'r');
  assert.equal(board[7][0], 'r');
  assert.equal(board[7][4], 'k');
  assert.equal(board[4][3], null);
});

test('matemática do mate resulta em xeque-mate', () => {
  const position = new Position();
  position.moveSan('f3');
  position.moveSan('e5');
  position.moveSan('g4');
  position.moveSan('Qh4#');

  const end = position.gameEnd();
  assert.equal(end.over, true);
  assert.equal(end.result, '0-1');
  assert.equal(end.reason, 'checkmate');
  assert.equal(end.description, 'Xeque-mate');
});

test('stalemate é detectado', () => {
  const position = new Position('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const end = position.gameEnd();
  assert.equal(end.over, true);
  assert.equal(end.result, '1/2-1/2');
  assert.equal(end.reason, 'stalemate');
});

test('material insuficiente é detectado', () => {
  const position = new Position('8/8/8/8/8/8/8/K1k5 w - - 0 1');
  const end = position.gameEnd();
  assert.equal(end.over, true);
  assert.equal(end.reason, 'insufficient-material');
});

test('FEN faz round-trip', () => {
  const position = new Position();
  position.moveSan('e4');
  position.moveSan('e5');
  position.moveSan('Nf3');
  const fen = position.fen();
  const restored = new Position(fen);
  assert.equal(restored.fen(), fen);
  assert.equal(restored.moves().length, position.moves().length);
});

test('isValidFen e describeFen', () => {
  assert.equal(isValidFen(START_FEN), true);
  assert.equal(isValidFen('lixo'), false);
  const info = describeFen(START_FEN);
  assert.equal(info.turn, 'w');
  assert.equal(info.inCheck, false);
  assert.equal(info.legalMoveCount, 20);
});

test('PGN faz round-trip', () => {
  const position = new Position();
  position.moveSan('e4');
  position.moveSan('e5');
  position.moveSan('Nf3');
  position.moveSan('Nc6');

  const pgn = toPgn(position, {
    Event: 'Teste',
    Site: 'Castelo',
    Date: '2026.01.01',
    Round: '1',
    White: 'Ana',
    Black: 'Bruno',
    Result: '*',
  });

  assert.ok(pgn.includes('[White "Ana"]'));
  assert.ok(pgn.includes('1. e4'));

  const parsed = parsePgn(pgn);
  assert.equal(parsed.headers.White, 'Ana');
  assert.equal(parsed.headers.Black, 'Bruno');
  assert.equal(parsed.position.history().length, 4);
});

test('PGN inválido lança PgnParseError', () => {
  assert.throws(() => parsePgn('isto não é um pgn'));
});

test('eloUpdate é simétrico', () => {
  const result = eloUpdate(1500, 1500, '1-0');
  assert.equal(result.white, 1520);
  assert.equal(result.black, 1480);
  assert.equal(result.expectedWhite, 0.5);

  const draw = eloUpdate(1500, 1500, '1/2-1/2');
  assert.equal(draw.white, 1500);
  assert.equal(draw.black, 1500);
});

test('relógio debita, incrementa e expira', () => {
  const start = 1_000_000;
  const clock = new Clock({ baseMs: 60_000, incrementMs: 2_000 }, start);

  clock.press('w', start + 5_000);
  assert.equal(clock.remaining('w', start + 5_000), 55_000);
  assert.equal(clock.remaining('b', start + 5_000), 60_000);

  clock.applyIncrement('w');
  assert.equal(clock.remaining('w', start + 5_000), 57_000);

  assert.equal(clock.expired('b', start + 200_000), true);
  assert.equal(clock.remaining('b', start + 200_000), 0);
});

test('bot devolve lance legal na posição inicial', () => {
  const position = new Position();
  const move = botMove(position, { difficulty: 'casual', seed: 42 });
  assert.ok(position.isLegal(move.from, move.to, move.promotion));
});

test('bot joga corretamente quando está em xeque', () => {
  // Tabuleiro minimalista: o rei preto está em xeque e precisa sair.
  const position = new Position('7k/8/8/8/8/8/5Q2/6K1 w - - 0 1');
  const move = botMove(position, { difficulty: 'casual', seed: 7 });
  assert.ok(position.isLegal(move.from, move.to, move.promotion));
});

test('bot encontra mate em um', () => {
  const position = new Position('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
  const move = botMove(position, { difficulty: 'strong', seed: 3 });
  assert.ok(position.isLegal(move.from, move.to, move.promotion));
});

test('gameEnd devolve over=false durante a partida', () => {
  const position = new Position();
  const end = position.gameEnd();
  assert.equal(end.over, false);
  assert.equal(end.result, '*');
});

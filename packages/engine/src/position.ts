import { Chess, type Move, type Square } from 'chess.js';
import type { Color, GameEnd, MoveInfo, PieceType } from './types.ts';

export class IllegalMoveError extends Error {
  code: 'illegal' | 'game-over' | 'bad-input';

  constructor(message: string, code: 'illegal' | 'game-over' | 'bad-input') {
    super(message);
    this.name = 'IllegalMoveError';
    this.code = code;
  }
}

const PIECE_TYPES: PieceType[] = ['k', 'q', 'r', 'b', 'n', 'p'];

const END_DESCRIPTIONS = {
  checkmate: 'Xeque-mate',
  stalemate: 'Empate por stalemate',
  'insufficient-material': 'Empate por material insuficiente',
  'threefold-repetition': 'Empate por repetição',
  'fifty-move-rule': 'Empate pela regra dos 50 lances',
  resignation: 'Desistência',
  timeout: 'Tempo esgotado',
  'draw-agreement': 'Empate por acordo',
  abandoned: 'Partida abandonada',
} as const;

function toPieceType(type: string): PieceType {
  if (!PIECE_TYPES.includes(type as PieceType)) {
    throw new IllegalMoveError(`Tipo de peça desconhecido: ${type}`, 'bad-input');
  }
  return type as PieceType;
}

function isSquare(value: unknown): value is Square {
  return typeof value === 'string' && /^[a-h][1-8]$/.test(value);
}

export class Position {
  private readonly chess: Chess;

  constructor(fen?: string) {
    try {
      this.chess = new Chess(fen);
    } catch (error) {
      throw new IllegalMoveError(
        `FEN inválido: ${(error as Error).message}`,
        'bad-input',
      );
    }
  }

  /* ------------------------------ leitura ------------------------------ */

  fen(): string {
    return this.chess.fen();
  }

  turn(): Color {
    return this.chess.turn();
  }

  /** Matriz 8x8 — linha 0 é o rank 8, coluna 0 é o arquivo a. */
  board(): (PieceType | null)[][] {
    return this.chess.board().map((row) =>
      row.map((cell) => (cell ? toPieceType(cell.type) : null)),
    );
  }

  get(square: string): { type: PieceType; color: Color } | null {
    if (!isSquare(square)) return null;
    const piece = this.chess.get(square);
    if (!piece) return null;
    return { type: toPieceType(piece.type), color: piece.color };
  }

  moves(): string[] {
    return this.chess.moves();
  }

  history(): MoveInfo[] {
    return this.chess.history({ verbose: true }).map((move) => this.toMoveInfo(move));
  }

  inCheck(): boolean {
    return this.chess.inCheck();
  }

  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  isDraw(): boolean {
    return this.chess.isDraw();
  }

  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  clone(): Position {
    return new Position(this.chess.fen());
  }

  /* ------------------------------ movimentos ---------------------------- */

  private toMoveInfo(move: Move): MoveInfo {
    const fenAfter = move.after;
    const fenBefore = move.before;
    const isPromotion = move.isPromotion();
    const isCapture = move.isCapture();

    return {
      san: move.san,
      lan: move.lan,
      from: move.from,
      to: move.to,
      promotion: isPromotion ? (move.promotion as 'q' | 'r' | 'b' | 'n') : undefined,
      piece: toPieceType(move.piece),
      captured: move.captured ? toPieceType(move.captured) : undefined,
      isCapture,
      isEnPassant: move.isEnPassant(),
      isCastling: move.isKingsideCastle() || move.isQueensideCastle(),
      isPromotion,
      isCheck: move.san.includes('+') || move.san.includes('#'),
      isCheckmate: move.san.includes('#'),
      isStalemate: false,
      fenBefore,
      fenAfter,
    };
  }

  legalMoves(): MoveInfo[] {
    return this.chess.moves({ verbose: true }).map((move) => this.toMoveInfo(move));
  }

  legalMovesFrom(square: string): MoveInfo[] {
    if (!isSquare(square)) return [];
    return this.chess
      .moves({ verbose: true, square })
      .map((move) => this.toMoveInfo(move));
  }

  isLegal(from: string, to: string, promotion?: string): boolean {
    if (!isSquare(from) || !isSquare(to)) return false;
    return this.chess
      .moves({ verbose: true })
      .some(
        (move) =>
          move.from === from &&
          move.to === to &&
          (!promotion || move.promotion === promotion),
      );
  }

  move(from: string, to: string, promotion?: string): MoveInfo {
    if (!isSquare(from) || !isSquare(to)) {
      throw new IllegalMoveError('Casa inválida.', 'bad-input');
    }
    if (this.chess.isGameOver()) {
      throw new IllegalMoveError('A partida já terminou.', 'game-over');
    }
    if (promotion && !['q', 'r', 'b', 'n'].includes(promotion)) {
      throw new IllegalMoveError('Peça de promoção inválida.', 'bad-input');
    }

    const legal = this.chess
      .moves({ verbose: true })
      .filter((move) => move.from === from && move.to === to);

    if (legal.length === 0) {
      throw new IllegalMoveError('Lance ilegal.', 'illegal');
    }

    const chosen = legal.find((move) => !promotion || move.promotion === promotion) ?? legal[0];

    try {
      const move = this.chess.move({
        from,
        to,
        promotion: chosen.promotion,
      });
      return this.toMoveInfo(move);
    } catch {
      throw new IllegalMoveError('Lance ilegal.', 'illegal');
    }
  }

  moveSan(san: string): MoveInfo {
    if (typeof san !== 'string' || san.trim() === '') {
      throw new IllegalMoveError('Lance inválido.', 'bad-input');
    }
    if (this.chess.isGameOver()) {
      throw new IllegalMoveError('A partida já terminou.', 'game-over');
    }
    try {
      const move = this.chess.move(san);
      return this.toMoveInfo(move);
    } catch {
      throw new IllegalMoveError(`Lance ilegal: ${san}`, 'illegal');
    }
  }

  undo(): MoveInfo | null {
    const move = this.chess.undo();
    return move ? this.toMoveInfo(move) : null;
  }

  /* ------------------------------- fim ---------------------------------- */

  gameEnd(): GameEnd {
    if (!this.chess.isGameOver()) {
      return { over: false, result: '*', reason: 'stalemate', description: '' };
    }

    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === 'w' ? '0-1' : '1-0';
      return { over: true, result: winner, reason: 'checkmate', description: END_DESCRIPTIONS.checkmate };
    }
    if (this.chess.isStalemate()) {
      return {
        over: true,
        result: '1/2-1/2',
        reason: 'stalemate',
        description: END_DESCRIPTIONS.stalemate,
      };
    }
    if (this.chess.isInsufficientMaterial()) {
      return {
        over: true,
        result: '1/2-1/2',
        reason: 'insufficient-material',
        description: END_DESCRIPTIONS['insufficient-material'],
      };
    }
    if (this.chess.isThreefoldRepetition()) {
      return {
        over: true,
        result: '1/2-1/2',
        reason: 'threefold-repetition',
        description: END_DESCRIPTIONS['threefold-repetition'],
      };
    }
    if (this.chess.isDrawByFiftyMoves()) {
      return {
        over: true,
        result: '1/2-1/2',
        reason: 'fifty-move-rule',
        description: END_DESCRIPTIONS['fifty-move-rule'],
      };
    }
    return {
      over: true,
      result: '1/2-1/2',
      reason: 'stalemate',
      description: END_DESCRIPTIONS.stalemate,
    };
  }

  /* -------------------------------- PGN --------------------------------- */

  /** Resultado da posição atual sem alterar o histórico. */
  private currentResult(): '1-0' | '0-1' | '1/2-1/2' | '*' {
    if (!this.chess.isGameOver()) return '*';
    if (this.chess.isCheckmate()) return this.chess.turn() === 'w' ? '0-1' : '1-0';
    return '1/2-1/2';
  }

  pgn(headers?: Record<string, string>): string {
    const base: Record<string, string> = {
      Event: 'Castelo',
      Site: 'Castelo',
      Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      Round: '-',
      White: '?',
      Black: '?',
      Result: '*',
    };
    const merged = { ...base, ...(headers ?? {}) };
    for (const key of Object.keys(merged)) {
      this.chess.setHeader(key, String(merged[key]));
    }
    this.chess.setHeader('Result', this.currentResult());
    return this.chess.pgn({ maxWidth: 80 });
  }

  loadPgn(pgn: string): void {
    try {
      this.chess.loadPgn(pgn, { strict: false });
    } catch (error) {
      throw new IllegalMoveError(`PGN inválido: ${(error as Error).message}`, 'bad-input');
    }
  }
}

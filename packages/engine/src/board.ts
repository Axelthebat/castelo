/**
 * Tabuleiro interno do bot.
 *
 * O `chess.js` é a referência de regras do projeto, mas o motor de busca
 * precisa de milhares de nós por segundo: `chess.moves({ verbose: true })`
 * custa ~856µs porque cada lance gera dois FEN. Aqui o tabuleiro é um
 * array de 64 casas com make/unmake — uma geração de lance custa poucos
 * microssegundos.
 *
 * A correção é garantida por teste: `perft()` compara a contagem de lances
 * com o chess.js em posições de referência.
 *
 * Convenção: índice = rank * 8 + file, com rank 0 = house 1 (a1 = 0).
 */

export const EMPTY = 0;
export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;

export const COLOR_OFFSET = 8;

/** Cor da peça: 0 = brancas, 1 = pretas. */
export function colorOf(piece: number): number {
  return piece < COLOR_OFFSET ? 0 : 1;
}

export interface InternalMove {
  from: number;
  to: number;
  piece: number;
  captured: number;
  promotion: number;
  /** 1 = avance duplo, 2 = captura en passant, 4 = roque, 8 = promoção */
  flags: number;
}

export const FLAG_DOUBLE = 1;
export const FLAG_EN_PASSANT = 2;
export const FLAG_CASTLE = 4;
export const FLAG_PROMOTION = 8;

/* ------------------------------------------------------------------ *
 * Zobrist
 * ------------------------------------------------------------------ */

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
}

const rng = makeRng(0x9e3779b9);

const ZOBRIST_PIECE = new Int32Array(64 * 12);
const ZOBRIST_CASTLE = new Int32Array(16);
const ZOBRIST_EP = new Int32Array(8);
const ZOBRIST_SIDE = new Int32Array(1);

for (let i = 0; i < ZOBRIST_PIECE.length; i += 1) ZOBRIST_PIECE[i] = rng() | 0;
for (let i = 0; i < 16; i += 1) ZOBRIST_CASTLE[i] = rng() | 0;
for (let i = 0; i < 8; i += 1) ZOBRIST_EP[i] = rng() | 0;
ZOBRIST_SIDE[0] = rng() | 0;

/* ------------------------------------------------------------------ *
 * Utilidades de casa
 * ------------------------------------------------------------------ */

const FILE = new Int8Array(64);
const RANK = new Int8Array(64);
for (let i = 0; i < 64; i += 1) {
  FILE[i] = i % 8;
  RANK[i] = i >> 3;
}

const KNIGHT_OFFSETS = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];

const KING_OFFSETS = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];

const BISHOP_DIRS = [
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const ROOK_DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/* ------------------------------------------------------------------ *
 * Tabuleiro
 * ------------------------------------------------------------------ */

interface UndoState {
  move: InternalMove;
  castling: number;
  ep: number;
  hashHi: number;
  hashLo: number;
}

export class Board {
  readonly squares = new Int8Array(64);
  /** 0 = brancas, 1 = pretas */
  turn = 0;
  /** 1 = K branca, 2 = Q branca, 4 = K preta, 8 = Q preta */
  castling = 0;
  /** índice da casa en passant, ou -1 */
  ep = -1;
  hashHi = 0;
  hashLo = 0;

  readonly kingSquare = new Int32Array([4, 60]);
  private readonly history: UndoState[] = [];

  constructor(fen?: string) {
    if (fen) this.load(fen);
  }

  /* ----------------------------- carga ----------------------------- */

  load(fen: string): void {
    const parts = fen.trim().split(/\s+/);
    const placement = parts[0] ?? '';
    this.squares.fill(EMPTY);

    let rank = 7;
    let file = 0;
    for (const char of placement) {
      if (char === '/') {
        rank -= 1;
        file = 0;
        continue;
      }
      if (char >= '1' && char <= '8') {
        file += Number(char);
        continue;
      }
      const lower = char.toLowerCase();
      const type =
        lower === 'p' ? PAWN : lower === 'n' ? KNIGHT : lower === 'b' ? BISHOP
          : lower === 'r' ? ROOK : lower === 'q' ? QUEEN : KING;
      const piece = char === lower ? type + COLOR_OFFSET : type;
      this.squares[rank * 8 + file] = piece;
      file += 1;
    }

    this.turn = parts[1] === 'b' ? 1 : 0;

    this.castling = 0;
    const rights = parts[2] ?? '-';
    if (rights.includes('K')) this.castling |= 1;
    if (rights.includes('Q')) this.castling |= 2;
    if (rights.includes('k')) this.castling |= 4;
    if (rights.includes('q')) this.castling |= 8;

    this.ep = -1;
    const epField = parts[3];
    if (epField && epField !== '-') {
      const file = epField.charCodeAt(0) - 97;
      const rank = Number(epField[1]) - 1;
      this.ep = rank * 8 + file;
    }

    this.updateKingSquares();
    this.recomputeHash();
  }

  private updateKingSquares(): void {
    for (let i = 0; i < 64; i += 1) {
      const piece = this.squares[i];
      if (piece === KING) this.kingSquare[0] = i;
      else if (piece === KING + COLOR_OFFSET) this.kingSquare[1] = i;
    }
  }

  private recomputeHash(): void {
    let hi = 0;
    let lo = 0;
    for (let i = 0; i < 64; i += 1) {
      const piece = this.squares[i];
      if (piece === EMPTY) continue;
      const slot = (piece - 1) * 64 + i;
      hi ^= ZOBRIST_PIECE[slot];
      lo ^= Math.imul(ZOBRIST_PIECE[slot], 0x9e3779b1);
    }
    hi ^= ZOBRIST_CASTLE[this.castling];
    lo ^= Math.imul(ZOBRIST_CASTLE[this.castling], 0x9e3779b1);
    if (this.ep >= 0) {
      hi ^= ZOBRIST_EP[FILE[this.ep]];
      lo ^= Math.imul(ZOBRIST_EP[FILE[this.ep]], 0x9e3779b1);
    }
    if (this.turn === 1) {
      hi ^= ZOBRIST_SIDE[0];
      lo ^= Math.imul(ZOBRIST_SIDE[0], 0x9e3779b1);
    }
    this.hashHi = hi | 0;
    this.hashLo = lo | 0;
  }

  private xorPiece(square: number, piece: number): void {
    const slot = (piece - 1) * 64 + square;
    this.hashHi ^= ZOBRIST_PIECE[slot];
    this.hashLo ^= Math.imul(ZOBRIST_PIECE[slot], 0x9e3779b1);
  }

  /* --------------------------- ataques ---------------------------- */

  /** A casa `square` é atacada pelo lado `byColor` (0 = brancas)? */
  isAttacked(square: number, byColor: number): boolean {
    const enemyPawn = PAWN + byColor * COLOR_OFFSET;
    const enemyKnight = KNIGHT + byColor * COLOR_OFFSET;
    const enemyKing = KING + byColor * COLOR_OFFSET;
    const enemyBishop = BISHOP + byColor * COLOR_OFFSET;
    const enemyRook = ROOK + byColor * COLOR_OFFSET;
    const enemyQueen = QUEEN + byColor * COLOR_OFFSET;

    const file = FILE[square];
    const rank = RANK[square];

    // Peões: as brancas atacam de baixo para cima (rank - 1).
    if (byColor === 0) {
      if (file > 0 && rank > 0 && this.squares[square - 9] === enemyPawn) return true;
      if (file < 7 && rank > 0 && this.squares[square - 7] === enemyPawn) return true;
    } else {
      if (file > 0 && rank < 7 && this.squares[square + 7] === enemyPawn) return true;
      if (file < 7 && rank < 7 && this.squares[square + 9] === enemyPawn) return true;
    }

    // Cavalos.
    for (const [df, dr] of KNIGHT_OFFSETS) {
      const f = file + df;
      const r = rank + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      if (this.squares[r * 8 + f] === enemyKnight) return true;
    }

    // Rei.
    for (const [df, dr] of KING_OFFSETS) {
      const f = file + df;
      const r = rank + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      if (this.squares[r * 8 + f] === enemyKing) return true;
    }

    // Diagonais.
    for (const [df, dr] of BISHOP_DIRS) {
      let f = file + df;
      let r = rank + dr;
      while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
        const piece = this.squares[r * 8 + f];
        if (piece !== EMPTY) {
          if (piece === enemyBishop || piece === enemyQueen) return true;
          break;
        }
        f += df;
        r += dr;
      }
    }

    // Retas.
    for (const [df, dr] of ROOK_DIRS) {
      let f = file + df;
      let r = rank + dr;
      while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
        const piece = this.squares[r * 8 + f];
        if (piece !== EMPTY) {
          if (piece === enemyRook || piece === enemyQueen) return true;
          break;
        }
        f += df;
        r += dr;
      }
    }

    return false;
  }

  /* --------------------------- geração --------------------------- */

  /** Lances pseudo-legais do lado a mover. */
  generatePseudoLegal(moves: InternalMove[]): InternalMove[] {
    moves.length = 0;
    const us = this.turn;
    const them = 1 - us;

    for (let from = 0; from < 64; from += 1) {
      const piece = this.squares[from];
      if (piece === EMPTY) continue;
      if (colorOf(piece) !== us) continue;

      const type = piece % COLOR_OFFSET === 0 ? piece : piece % COLOR_OFFSET;
      const file = FILE[from];
      const rank = RANK[from];

      if (type === PAWN) {
        const direction = us === 0 ? 1 : -1;
        const startRank = us === 0 ? 1 : 6;
        const promotionRank = us === 0 ? 7 : 0;

        const oneRank = rank + direction;
        if (oneRank >= 0 && oneRank <= 7) {
          const one = oneRank * 8 + file;
          if (this.squares[one] === EMPTY) {
            if (oneRank === promotionRank) {
              for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) {
                moves.push({
                  from, to: one, piece, captured: EMPTY, promotion: promo,
                  flags: FLAG_PROMOTION,
                });
              }
            } else {
              moves.push({ from, to: one, piece, captured: EMPTY, promotion: 0, flags: 0 });
              const twoRank = rank + direction * 2;
              if (rank === startRank) {
                const two = twoRank * 8 + file;
                if (this.squares[two] === EMPTY) {
                  moves.push({
                    from, to: two, piece, captured: EMPTY, promotion: 0,
                    flags: FLAG_DOUBLE,
                  });
                }
              }
            }
          }

          for (const df of [-1, 1]) {
            const f = file + df;
            if (f < 0 || f > 7) continue;
            const target = oneRank * 8 + f;
            const occupant = this.squares[target];
            if (occupant !== EMPTY && (occupant < COLOR_OFFSET ? 0 : 1) === them) {
              if (oneRank === promotionRank) {
                for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) {
                  moves.push({
                    from, to: target, piece, captured: occupant, promotion: promo,
                    flags: FLAG_PROMOTION,
                  });
                }
              } else {
                moves.push({
                  from, to: target, piece, captured: occupant, promotion: 0, flags: 0,
                });
              }
            } else if (occupant === EMPTY && target === this.ep) {
              // Captura en passant: a casa ep fica na diagonal normal do peão.
              moves.push({
                from, to: target, piece, captured: PAWN + them * COLOR_OFFSET,
                promotion: 0, flags: FLAG_EN_PASSANT,
              });
            }
          }
        }
        continue;
      }

      if (type === KNIGHT || type === KING) {
        const offsets = type === KNIGHT ? KNIGHT_OFFSETS : KING_OFFSETS;
        for (const [df, dr] of offsets) {
          const f = file + df;
          const r = rank + dr;
          if (f < 0 || f > 7 || r < 0 || r > 7) continue;
          const target = r * 8 + f;
          const occupant = this.squares[target];
          if (occupant === EMPTY) {
            moves.push({ from, to: target, piece, captured: EMPTY, promotion: 0, flags: 0 });
          } else if ((occupant < COLOR_OFFSET ? 0 : 1) === them) {
            moves.push({ from, to: target, piece, captured: occupant, promotion: 0, flags: 0 });
          }
          // Casa ocupada por peça ally: o lance não existe.
        }
        continue;
      }

      const dirs =
        type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS];
      for (const [df, dr] of dirs) {
        let f = file + df;
        let r = rank + dr;
        while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
          const target = r * 8 + f;
          const occupant = this.squares[target];
          if (occupant === EMPTY) {
            moves.push({ from, to: target, piece, captured: EMPTY, promotion: 0, flags: 0 });
          } else {
            if ((occupant < COLOR_OFFSET ? 0 : 1) === them) {
              moves.push({
                from, to: target, piece, captured: occupant, promotion: 0, flags: 0,
              });
            }
            break;
          }
          f += df;
          r += dr;
        }
      }
    }

    this.generateCastles(moves, us);
    return moves;
  }

  private generateCastles(moves: InternalMove[], us: number): void {
    const backRank = us === 0 ? 0 : 7;
    const king = KING + us * COLOR_OFFSET;
    const rook = ROOK + us * COLOR_OFFSET;
    if (this.squares[backRank * 8 + 4] !== king) return;

    const kingSide = us === 0 ? 1 : 4;
    const queenSide = us === 0 ? 2 : 8;
    const them = 1 - us;

    if (this.castling & kingSide) {
      const f1 = backRank * 8 + 5;
      const g1 = backRank * 8 + 6;
      const h1 = backRank * 8 + 7;
      if (
        this.squares[f1] === EMPTY &&
        this.squares[g1] === EMPTY &&
        this.squares[h1] === rook &&
        !this.isAttacked(backRank * 8 + 4, them) &&
        !this.isAttacked(f1, them) &&
        !this.isAttacked(g1, them)
      ) {
        moves.push({
          from: backRank * 8 + 4, to: g1, piece: king, captured: EMPTY, promotion: 0,
          flags: FLAG_CASTLE,
        });
      }
    }

    if (this.castling & queenSide) {
      const d1 = backRank * 8 + 3;
      const c1 = backRank * 8 + 2;
      const b1 = backRank * 8 + 1;
      const a1 = backRank * 8 + 0;
      if (
        this.squares[d1] === EMPTY &&
        this.squares[c1] === EMPTY &&
        this.squares[b1] === EMPTY &&
        this.squares[a1] === rook &&
        !this.isAttacked(backRank * 8 + 4, them) &&
        !this.isAttacked(d1, them) &&
        !this.isAttacked(c1, them)
      ) {
        moves.push({
          from: backRank * 8 + 4, to: c1, piece: king, captured: EMPTY, promotion: 0,
          flags: FLAG_CASTLE,
        });
      }
    }
  }

  /** Só capturas e promoções (para a quiescência). */
  generatePseudoLegalCaptures(moves: InternalMove[]): InternalMove[] {
    const all = this.generatePseudoLegal([]);
    moves.length = 0;
    for (const move of all) {
      if (move.captured !== EMPTY || move.promotion !== 0) moves.push(move);
    }
    return moves;
  }

  /** Capturas legais: as pseudo-legais filtradas por segurança do rei. */
  generateLegalCaptures(moves: InternalMove[]): InternalMove[] {
    const pseudo = this.generatePseudoLegalCaptures([]);
    const legal: InternalMove[] = [];
    for (const move of pseudo) {
      this.makeMove(move);
      if (!this.isAttacked(this.kingSquare[1 - this.turn], this.turn)) {
        legal.push(move);
      }
      this.unmakeMove();
    }
    moves.length = 0;
    moves.push(...legal);
    return legal;
  }

  /** Lances legais: pseudo-legais filtrados por segurança do rei. */
  generateLegal(moves: InternalMove[]): InternalMove[] {
    const pseudo = this.generatePseudoLegal([]);
    const legal: InternalMove[] = [];
    for (const move of pseudo) {
      this.makeMove(move);
      // Depois do lance, `turn` é o adversário: o rei a checar é o do jogador
      // que acabou de mover, e o atacante é o adversário.
      if (!this.isAttacked(this.kingSquare[1 - this.turn], this.turn)) {
        legal.push(move);
      }
      this.unmakeMove();
    }
    moves.length = 0;
    moves.push(...legal);
    return legal;
  }

  /** Existe um peão de `color` capaz de capturar en passant na casa `epSquare`? */
  private hasEnPassantCapture(epSquare: number, color: number): boolean {
    const file = FILE[epSquare];
    const rank = RANK[epSquare];
    const pawn = PAWN + color * COLOR_OFFSET;
    // O peão que captura fica na linha ep-1 quando é branco, ep+1 quando é preto.
    const fromRank = color === 0 ? rank - 1 : rank + 1;
    if (fromRank < 0 || fromRank > 7) return false;
    for (const df of [-1, 1]) {
      const f = file + df;
      if (f < 0 || f > 7) continue;
      if (this.squares[fromRank * 8 + f] === pawn) return true;
    }
    return false;
  }

  /* --------------------------- make/unmake --------------------------- */

  makeMove(move: InternalMove): void {
    const undo: UndoState = {
      move,
      castling: this.castling,
      ep: this.ep,
      hashHi: this.hashHi,
      hashLo: this.hashLo,
    };

    const us = this.turn;
    const them = 1 - us;

    // Hash: remove a peça que sai e a que é capturada.
    this.xorPiece(move.from, move.piece);
    if (move.captured !== EMPTY) {
      const capturedSquare = (move.flags & FLAG_EN_PASSANT)
        ? (us === 0 ? move.to - 8 : move.to + 8)
        : move.to;
      this.xorPiece(capturedSquare, move.captured);
    }
    this.xorPiece(move.to, move.promotion !== 0 ? move.promotion + us * COLOR_OFFSET : move.piece);

    // Desloca a peça.
    this.squares[move.from] = EMPTY;
    if (move.flags & FLAG_EN_PASSANT) {
      const capturedSquare = us === 0 ? move.to - 8 : move.to + 8;
      this.squares[capturedSquare] = EMPTY;
    }
    if (move.promotion !== 0) {
      this.squares[move.to] = move.promotion + us * COLOR_OFFSET;
    } else {
      this.squares[move.to] = move.piece;
    }

    // Roque: move também a torre.
    if (move.flags & FLAG_CASTLE) {
      const backRank = us === 0 ? 0 : 7;
      const kingSide = move.to > backRank * 8 + 4;
      const rookFrom = backRank * 8 + (kingSide ? 7 : 0);
      const rookTo = backRank * 8 + (kingSide ? 5 : 3);
      const rook = ROOK + us * COLOR_OFFSET;
      this.squares[rookTo] = this.squares[rookFrom];
      this.squares[rookFrom] = EMPTY;
      this.xorPiece(rookFrom, rook);
      this.xorPiece(rookTo, rook);
    }

    // Direitos de roque.
    if (move.piece % COLOR_OFFSET === KING) {
      this.castling &= us === 0 ? ~0b0011 : ~0b1100;
    } else if (move.piece % COLOR_OFFSET === ROOK) {
      // h1 = 7, a1 = 0, h8 = 63, a8 = 56 (rank 0 = house 1).
      if (move.from === 7) this.castling &= ~1;
      if (move.from === 0) this.castling &= ~2;
      if (move.from === 63) this.castling &= ~4;
      if (move.from === 56) this.castling &= ~8;
    }
    if (move.captured !== EMPTY) {
      if (move.to === 7) this.castling &= ~1;
      if (move.to === 0) this.castling &= ~2;
      if (move.to === 63) this.castling &= ~4;
      if (move.to === 56) this.castling &= ~8;
    }

    // En passant: só é registrado quando um peão adversário pode capturar.
    this.ep = -1;
    if (move.flags & FLAG_DOUBLE) {
      const candidate = us === 0 ? move.from + 8 : move.from - 8;
      if (this.hasEnPassantCapture(candidate, them)) this.ep = candidate;
    }

    // Hash: castling, ep e lado a mover.
    this.hashHi ^= ZOBRIST_CASTLE[undo.castling] ^ ZOBRIST_CASTLE[this.castling];
    this.hashLo ^=
      Math.imul(ZOBRIST_CASTLE[undo.castling] ^ ZOBRIST_CASTLE[this.castling], 0x9e3779b1);
    if (undo.ep >= 0) {
      this.hashHi ^= ZOBRIST_EP[FILE[undo.ep]];
      this.hashLo ^= Math.imul(ZOBRIST_EP[FILE[undo.ep]], 0x9e3779b1);
    }
    if (this.ep >= 0) {
      this.hashHi ^= ZOBRIST_EP[FILE[this.ep]];
      this.hashLo ^= Math.imul(ZOBRIST_EP[FILE[this.ep]], 0x9e3779b1);
    }
    this.hashHi ^= ZOBRIST_SIDE[0];
    this.hashLo ^= Math.imul(ZOBRIST_SIDE[0], 0x9e3779b1);

    // `move.piece` guarda o código com a cor: o rei preto é 14, não 6.
    if (move.piece % COLOR_OFFSET === KING) this.kingSquare[us] = move.to;
    this.turn = them;
    this.history.push(undo);
  }

  unmakeMove(): void {
    const undo = this.history.pop();
    if (!undo) return;
    const move = undo.move;
    const us = this.turn;

    this.turn = us === 0 ? 1 : 0;
    const them = this.turn;

    if (move.piece % COLOR_OFFSET === KING) this.kingSquare[this.turn] = move.from;

    if (move.promotion !== 0) {
      this.squares[move.from] = move.piece;
      this.squares[move.to] = EMPTY;
    } else {
      this.squares[move.from] = this.squares[move.to];
      this.squares[move.to] = EMPTY;
    }

    if (move.flags & FLAG_EN_PASSANT) {
      const capturedSquare = them === 0 ? move.to - 8 : move.to + 8;
      this.squares[capturedSquare] = move.captured;
    } else if (move.captured !== EMPTY) {
      this.squares[move.to] = move.captured;
    }

    if (move.flags & FLAG_CASTLE) {
      const backRank = them === 0 ? 0 : 7;
      const kingSide = move.to > backRank * 8 + 4;
      const rookFrom = backRank * 8 + (kingSide ? 7 : 0);
      const rookTo = backRank * 8 + (kingSide ? 5 : 3);
      this.squares[rookFrom] = this.squares[rookTo];
      this.squares[rookTo] = EMPTY;
    }

    this.castling = undo.castling;
    this.ep = undo.ep;
    this.hashHi = undo.hashHi;
    this.hashLo = undo.hashLo;
  }

  /* ---------------------------- perft ---------------------------- */

  /** Número de nós a `depth` lances — usado para validar contra o chess.js. */
  perft(depth: number): number {
    if (depth === 0) return 1;
    const moves = this.generateLegal([]);
    if (depth === 1) return moves.length;
    let total = 0;
    for (const move of moves) {
      this.makeMove(move);
      total += this.perft(depth - 1);
      this.unmakeMove();
    }
    return total;
  }
}

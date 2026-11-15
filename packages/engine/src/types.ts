export type Color = 'w' | 'b';
export type PieceType = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export interface MoveInfo {
  san: string;
  lan: string;
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
  piece: PieceType;
  captured?: PieceType;
  isCapture: boolean;
  isEnPassant: boolean;
  isCastling: boolean;
  isPromotion: boolean;
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  fenBefore: string;
  fenAfter: string;
}

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export type GameEndReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient-material'
  | 'threefold-repetition'
  | 'fifty-move-rule'
  | 'resignation'
  | 'timeout'
  | 'draw-agreement'
  | 'abandoned';

export interface GameEnd {
  over: boolean;
  result: GameResult;
  reason: GameEndReason;
  description: string;
}

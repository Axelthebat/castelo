import { Position } from './position.ts';

export interface PgnHeaders {
  Event?: string;
  Site?: string;
  Date?: string;
  Round?: string;
  White?: string;
  Black?: string;
  WhiteElo?: number;
  BlackElo?: number;
  Result?: string;
  TimeControl?: string;
  Termination?: string;
  [key: string]: string | number | undefined;
}

export class PgnParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PgnParseError';
  }
}

const SEVEN_TAG_ROSTER = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'] as const;

/** Gera PGN a partir de uma posição e dos cabeçalhos informados. */
export function toPgn(position: Position, headers: PgnHeaders): string {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === null) continue;
    sanitized[key] = String(value);
  }
  if (!sanitized.Result) sanitized.Result = position.gameEnd().result;  if (!sanitized.Event) sanitized.Event = 'Castelo';
  if (!sanitized.Site) sanitized.Site = 'Castelo';
  if (!sanitized.Date) sanitized.Date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  if (!sanitized.Round) sanitized.Round = '-';
  if (!sanitized.White) sanitized.White = '?';
  if (!sanitized.Black) sanitized.Black = '?';

  return position.pgn(sanitized);
}

/** Lê um PGN e devolve os cabeçalhos e a posição final. */
export function parsePgn(pgn: string): { headers: PgnHeaders; position: Position } {
  if (typeof pgn !== 'string' || pgn.trim() === '') {
    throw new PgnParseError('PGN vazio.');
  }

  const headers: PgnHeaders = {};
  const pairs = pgn.matchAll(/\[\s*(\w+)\s+"([^"]*)"\s*\]/g);
  for (const match of pairs) {
    headers[match[1]] = match[2];
  }

  if (!Object.keys(headers).some((key) => (SEVEN_TAG_ROSTER as readonly string[]).includes(key))) {
    throw new PgnParseError('O PGN não tem o cabeçalho obrigatório de sete tags.');
  }

  const position = new Position();
  try {
    position.loadPgn(pgn);
  } catch (error) {
    throw new PgnParseError(`PGN inválido: ${(error as Error).message}`);
  }

  return { headers, position };
}

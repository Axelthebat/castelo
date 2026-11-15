/**
 * Logger estruturado mínimo (JSON). Nunca logar segredos (senhas, tokens,
 * cookies, SESSION_SECRET). Em produção os logs devem ir para stdout e serem
 * coletados por um agregador externo.
 */

type Level = 'info' | 'warn' | 'error';

function write(level: Level, msg: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...(meta ?? {}) });
  if (level === 'error') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => write('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('error', msg, meta),
};

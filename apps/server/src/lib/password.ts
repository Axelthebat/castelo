import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Hash de senha com scrypt (node:crypto).
 * Formato armazenado: `scrypt$N$r$p$salt_b64$hash_b64`.
 * - N = 2^15, r = 8, p = 1, keylen = 64
 * - salt aleatório de 16 bytes por senha
 * - verificação com timingSafeEqual; entrada malformada → false
 */

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;
const MAX_PASSWORD_LEN = 200;
// 128*N*r = 32 MiB, exatamente no limite default do Node (32 MiB) — por isso
// o maxmem explícito é obrigatório para N=2^15, r=8.
const MAXMEM = 128 * 1024 * 1024;
const SCRYPT_OPTIONS = { N, r: R, p: P, maxmem: MAXMEM } as const;

export function hashPassword(password: string): string {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LEN) {
    throw new Error('Senha inválida');
  }
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT_OPTIONS);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LEN) {
    return false;
  }
  if (typeof stored !== 'string') return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n <= 0 || r <= 0 || p <= 0) return false;
  // limites sanitários para não aceitar parâmetros absurdos de um hash forjado
  if (n > 2 ** 20 || r > 32 || p > 16) return false;

  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (salt.length !== SALT_BYTES || expected.length !== KEYLEN) return false;

  let actual: Buffer;
  try {
    actual = scryptSync(password, salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM });
  } catch {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

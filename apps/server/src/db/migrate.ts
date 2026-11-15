import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import { loadEnv } from '../env.ts';
import { openDatabase } from './index.ts';
import { runSeed } from './seed.ts';
import { logger } from '../lib/logger.ts';

/**
 * Migração standalone e idempotente: aplica schema.sql (CREATE TABLE IF NOT EXISTS).
 * Uso: `node --experimental-strip-types src/db/migrate.ts [--seed]`
 */

function tableCount(db: DatabaseSync): number {
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .get() as { total: number };
  return row.total;
}

const isMain = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMain) {
  const env = loadEnv();
  const db = openDatabase(env.DATABASE_PATH);
  try {
    const tables = tableCount(db);
    if (process.argv.includes('--seed')) {
      runSeed(db);
    }
    logger.info('Migração aplicada', { database: env.DATABASE_PATH, tables });
  } finally {
    db.close();
  }
}

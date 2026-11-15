import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEnv } from '../env.ts';

/**
 * Abertura do banco e aplicação do schema.
 * O schema fica em `src/db/schema.sql`; o caminho é resolvido de forma
 * compatível com o run em TS puro (src) e com o build (dist).
 */

const SCHEMA_CANDIDATES = ['../../src/db/schema.sql', './schema.sql'] as const;

export function loadSchemaSql(): string {
  for (const candidate of SCHEMA_CANDIDATES) {
    try {
      return readFileSync(fileURLToPath(new URL(candidate, import.meta.url)), 'utf8');
    } catch {
      // tenta o próximo candidato
    }
  }
  throw new Error('schema.sql não encontrado');
}

export function openDatabase(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(loadSchemaSql());
  return db;
}

let instance: DatabaseSync | null = null;

/** Singleton usado pelas rotas em produção. Em testes, use setDb(). */
export function getDb(): DatabaseSync {
  if (!instance) instance = openDatabase(getEnv().DATABASE_PATH);
  return instance;
}

export function setDb(db: DatabaseSync): void {
  instance = db;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

export type { DatabaseSync };

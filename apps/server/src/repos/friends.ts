import type { DatabaseSync } from 'node:sqlite';
import type { Friend } from '@castelo/shared';
import { newId } from '../lib/ids.ts';
import { nowIso } from '../lib/time.ts';
import { avatarSeed } from './ratings.ts';

/** Amizades e pedidos de amizade. Consultas parameterizadas. */

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
}

export function findFriendship(db: DatabaseSync, id: string): FriendshipRow | null {
  return (db.prepare('SELECT * FROM friendships WHERE id = ?').get(id) as FriendshipRow | undefined) ?? null;
}

export function findFriendshipBetween(
  db: DatabaseSync,
  a: string,
  b: string,
): FriendshipRow | null {
  return (
    (db.prepare('SELECT * FROM friendships WHERE requester_id = ? AND addressee_id = ?').get(a, b) as
      | FriendshipRow
      | undefined) ?? null
  );
}

export function listFriends(db: DatabaseSync, userId: string): Friend[] {
  const rows = db
    .prepare(
      `SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
              u.username AS other_username, u.rating_blitz AS other_rating,
              u.id AS other_id
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = ? OR f.addressee_id = ?
       ORDER BY f.created_at DESC`,
    )
    .all(userId, userId, userId) as Array<{
    id: string;
    requester_id: string;
    addressee_id: string;
    status: string;
    created_at: string;
    other_username: string;
    other_rating: number;
    other_id: string;
  }>;

  return rows.map((row) => {
    const status: Friend['status'] =
      row.status === 'friends' ? 'friends' : row.requester_id === userId ? 'pending_out' : 'pending_in';
    return {
      id: row.other_id,
      username: row.other_username,
      rating: row.other_rating,
      status,
      avatarSeed: avatarSeed(row.other_id),
      lastSeenAt: null,
    };
  });
}

export function createFriendRequest(
  db: DatabaseSync,
  requesterId: string,
  addresseeId: string,
): FriendshipRow {
  if (requesterId === addresseeId) throw new Error('Não é possível adicionar a si mesmo');
  const existing =
    findFriendshipBetween(db, requesterId, addresseeId) ?? findFriendshipBetween(db, addresseeId, requesterId);
  if (existing) return existing;

  const id = newId();
  db.prepare(
    "INSERT INTO friendships (id, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
  ).run(id, requesterId, addresseeId, nowIso());
  const created = findFriendship(db, id);
  if (!created) throw new Error('Falha ao criar pedido de amizade');
  return created;
}

export function acceptFriendRequest(db: DatabaseSync, id: string, userId: string): FriendshipRow | null {
  const row = findFriendship(db, id);
  if (!row || row.addressee_id !== userId || row.status !== 'pending') return null;
  db.prepare("UPDATE friendships SET status = 'friends' WHERE id = ?").run(id);
  return findFriendship(db, id);
}

export function removeFriendship(db: DatabaseSync, id: string, userId: string): boolean {
  const row = findFriendship(db, id);
  if (!row) return false;
  if (row.requester_id !== userId && row.addressee_id !== userId) return false;
  db.prepare('DELETE FROM friendships WHERE id = ?').run(id);
  return true;
}

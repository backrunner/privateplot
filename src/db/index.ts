import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

let db: DrizzleD1Database<typeof schema>;

export function getDb(d1: D1Database) {
  if (!db) {
    db = drizzle(d1, { schema });
  }
  return db;
}

export type Database = typeof db;

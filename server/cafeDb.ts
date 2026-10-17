import { getDb } from "./db";

/**
 * CafeFlow state is durable-only. Do not silently fall back to in-memory data
 * when the managed database is unavailable.
 */
export async function requireCafeDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is unavailable");
  }
  return db;
}

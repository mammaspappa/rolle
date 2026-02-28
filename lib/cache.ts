/**
 * Simple Redis cache utility.
 * Uses the existing ioredis connection (not the BullMQ bundled one).
 */

import { redis } from "@/server/jobs/redis";

/**
 * Get a cached value or compute + store it.
 *
 * @param key    Cache key
 * @param ttl    Time-to-live in seconds
 * @param fn     Function to call on cache miss
 */
export async function getCached<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const raw = await redis.get(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // Redis miss or error — fall through to DB
  }

  const value = await fn();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch {
    // Non-fatal — continue without caching
  }

  return value;
}

/**
 * Invalidate one or more cache keys.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Non-fatal
  }
}

/** Cache key constants */
export const CACHE_KEYS = {
  INVENTORY_GRID: "inventory:grid:v1",
} as const;

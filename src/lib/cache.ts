// Two-layer cache (in-memory + on-disk) keyed by reset window. On fetch failure,
// callers can fall back to the last cached value (even if stale) plus a note.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { config } from "../config.js";

interface Entry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
  windowKey: string;
}

const mem = new Map<string, Entry<unknown>>();

function diskPath(key: string): string {
  const safe = createHash("sha1").update(key).digest("hex");
  return resolve(config.cacheDir, `${safe}.json`);
}

function ensureCacheDir(): void {
  if (!existsSync(config.cacheDir)) mkdirSync(config.cacheDir, { recursive: true });
}

function readDisk<T>(key: string): Entry<T> | undefined {
  try {
    const p = diskPath(key);
    if (!existsSync(p)) return undefined;
    return JSON.parse(readFileSync(p, "utf8")) as Entry<T>;
  } catch {
    return undefined;
  }
}

function writeDisk<T>(key: string, entry: Entry<T>): void {
  try {
    ensureCacheDir();
    writeFileSync(diskPath(key), JSON.stringify(entry), "utf8");
  } catch (err) {
    console.error(`[cache] disk write failed for ${key}:`, err);
  }
}

export interface CacheResult<T> {
  value: T;
  fresh: boolean;
  storedAt: number;
  windowKey: string;
}

export function paramsHash(params: unknown): string {
  return createHash("sha1").update(JSON.stringify(params ?? {})).digest("hex").slice(0, 10);
}

/**
 * Get-or-fetch with reset-window keying. On a fetch error, returns the last
 * cached value (stale) when available; otherwise rethrows.
 */
export async function withCache<T>(
  source: string,
  windowKey: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  params?: unknown,
): Promise<CacheResult<T>> {
  const key = `${source}:${windowKey}:${paramsHash(params)}`;
  const now = Date.now();

  const cached = (mem.get(key) as Entry<T> | undefined) ?? readDisk<T>(key);
  if (cached && cached.expiresAt > now && cached.windowKey === windowKey) {
    return { value: cached.value, fresh: true, storedAt: cached.storedAt, windowKey };
  }

  try {
    const value = await fetcher();
    const entry: Entry<T> = { value, storedAt: now, expiresAt: now + ttlMs, windowKey };
    mem.set(key, entry);
    writeDisk(key, entry);
    return { value, fresh: true, storedAt: now, windowKey };
  } catch (err) {
    if (cached) {
      console.error(`[cache] ${source} fetch failed, serving stale:`, err);
      return { value: cached.value, fresh: false, storedAt: cached.storedAt, windowKey: cached.windowKey };
    }
    throw err;
  }
}

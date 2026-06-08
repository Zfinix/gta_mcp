// Plain HTTP client over the global fetch (Node 18+). Detects Cloudflare
// challenges so callers can route to the browser fallback.
import { config } from "../config.js";

export class CloudflareBlockedError extends Error {
  constructor(url: string) {
    super(`Cloudflare challenge blocked: ${url}`);
    this.name = "CloudflareBlockedError";
  }
}

interface FetchOpts {
  timeoutMs?: number;
  retries?: number;
  accept?: string;
}

function looksLikeCloudflare(status: number, body: string): boolean {
  if (status !== 403 && status !== 503) return false;
  const b = body.toLowerCase();
  return (
    b.includes("just a moment") ||
    b.includes("cf-mitigated") ||
    b.includes("__cf_chl") ||
    b.includes("challenge-platform")
  );
}

async function once(url: string, opts: FetchOpts): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": config.userAgent,
        Accept: opts.accept ?? "application/json, text/plain, */*",
      },
      signal: controller.signal,
    });
    const text = await res.text();
    if (looksLikeCloudflare(res.status, text)) throw new CloudflareBlockedError(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url: string, opts: FetchOpts = {}): Promise<string> {
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await once(url, opts);
    } catch (err) {
      if (err instanceof CloudflareBlockedError) throw err; // don't retry CF
      lastErr = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
  const text = await fetchText(url, opts);
  return JSON.parse(text) as T;
}

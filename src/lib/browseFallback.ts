// Browser fallback for Cloudflare-protected sources (gtaweb.eu). Shells out to
// the `browse` CLI (Browserbase) to run a fetch inside a real browser context
// that has already cleared the challenge. Read-only network operation.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

export class BrowseUnavailableError extends Error {
  constructor(reason: string) {
    super(`Browser fallback unavailable: ${reason}`);
    this.name = "BrowseUnavailableError";
  }
}

let originOpened: Record<string, boolean> = {};

async function runBrowse(args: string[], timeoutMs = 45000): Promise<string> {
  const { stdout } = await execFileAsync(config.browseBin, args, {
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

/** Ensure a browser session has the origin open (clears Cloudflare once). */
async function ensureOrigin(origin: string): Promise<void> {
  if (originOpened[origin]) return;
  await runBrowse(["open", origin, "--wait", "domcontentloaded"]);
  originOpened[origin] = true;
}

/**
 * Fetch a URL through the browser. Opens the origin first (to pass Cloudflare),
 * then evals an in-page fetch. Returns the response body text.
 */
export async function browseFetchText(url: string): Promise<string> {
  if (!config.browseFallback) {
    throw new BrowseUnavailableError("BROWSE_FALLBACK=0");
  }
  const origin = new URL(url).origin;
  try {
    await ensureOrigin(origin);
    const expr = `fetch(${JSON.stringify(url)}, { headers: { accept: "application/json, text/plain, */*" } }).then(r => r.text())`;
    const stdout = await runBrowse(["eval", expr]);
    return parseEvalResult(stdout);
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      throw new BrowseUnavailableError(`'${config.browseBin}' not found on PATH`);
    }
    throw err;
  }
}

export async function browseFetchJson<T = unknown>(url: string): Promise<T> {
  return JSON.parse(await browseFetchText(url)) as T;
}

/**
 * `browse eval` prints a JSON envelope like {"result": <value>}. Extract the
 * string result; fall back to raw stdout if the shape is unexpected.
 */
function parseEvalResult(stdout: string): string {
  const trimmed = stdout.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && "result" in parsed) {
      const r = (parsed as { result: unknown }).result;
      return typeof r === "string" ? r : JSON.stringify(r);
    }
  } catch {
    // not the envelope; fall through
  }
  return trimmed;
}

/** Reset the opened-origin memo (e.g. if a session was recycled). */
export function resetBrowseSession(): void {
  originOpened = {};
}

// Browser helpers for capturing GTA map screenshots and extracting the live
// data panel from gtalens.com/map. Uses the `browse` CLI; best-effort with
// graceful failure so map tools fall back to URLs when the browser is down.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { config } from "../config.js";

const execFileAsync = promisify(execFile);

async function runBrowse(args: string[], timeoutMs = 60000): Promise<string> {
  const { stdout } = await execFileAsync(config.browseBin, args, {
    timeout: timeoutMs,
    maxBuffer: 128 * 1024 * 1024,
  });
  return stdout;
}

export function gtalensMapUrl(slug: string): string {
  return `https://gtalens.com/map/${slug}`;
}

async function openMap(slug: string): Promise<void> {
  await runBrowse(
    ["open", gtalensMapUrl(slug), "--wait", "networkidle"],
    60000,
  );
}

export interface MapCapture {
  imageBase64: string;
  mimeType: "image/png";
}

/** Open the gtalens map for a category and capture a PNG screenshot. */
export async function captureMap(slug: string): Promise<MapCapture> {
  if (!config.browseFallback)
    throw new Error("browser fallback disabled (BROWSE_FALLBACK=0)");
  await openMap(slug);
  const file = resolve(
    tmpdir(),
    `gta-map-${slug.replace(/[^a-z0-9-]/gi, "_")}-${process.pid}-${Date.now()}.png`,
  );
  try {
    await runBrowse(["screenshot", "-p", file, "--type", "png"], 45000);
    const buf = readFileSync(file);
    return { imageBase64: buf.toString("base64"), mimeType: "image/png" };
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

/** Extract the live location/price panel text from the current gtalens map. */
export async function mapPanelText(slug: string): Promise<string> {
  if (!config.browseFallback)
    throw new Error("browser fallback disabled (BROWSE_FALLBACK=0)");
  await openMap(slug);
  // Pull the data panel text out of the page. gtalens renders a right-hand panel
  // with "Location #N" headers and product/price tables; slice from there and
  // drop the nav/ad chrome.
  const expr = `(() => {
    const lines = (document.body.innerText || '').split('\\n').map(l => l.trim()).filter(Boolean);
    const junk = /^(GTALENS|Jobs|Collections|Map|Weather|Support|Log In|Register|Game|Print|Satellite|Hide|Today|Profile)/i;
    let start = lines.findIndex(l => /^Location\\s*#?\\d/i.test(l));
    if (start < 0) start = lines.findIndex(l => /(Max Qt|Unit Price|Total Price|Spawns?|Payout)/i.test(l));
    const slice = (start >= 0 ? lines.slice(start, start + 120) : lines.slice(0, 80)).filter(l => !junk.test(l));
    return slice.join('\\n').slice(0, 3000);
  })()`;
  const stdout = await runBrowse(["eval", expr], 45000);
  return parseEvalResult(stdout);
}

function parseEvalResult(stdout: string): string {
  const trimmed = stdout.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && "result" in parsed) {
      const r = (parsed as { result: unknown }).result;
      return typeof r === "string" ? r : JSON.stringify(r);
    }
  } catch {
    /* not the envelope */
  }
  return trimmed;
}

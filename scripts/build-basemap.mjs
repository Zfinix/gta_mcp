// Build data/basemap.jpg from Rockstar's official GTAV "game" map tiles (the clean
// colored in-game atlas, via s.rsg.sc) — the same tiles gtalens.com/map uses.
// Uses the `browse` CLI to fetch tiles (one-time build); runtime stays offline.
// Also writes data/basemap-meta.json with the tile bbox/zoom for calibration.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, "..", "data");
const browseBin = process.env.BROWSE_BIN || "browse";

const ZOOM = Number(process.env.MAP_ZOOM || 5);
const TILE = 256;
const BASE = `https://s.rsg.sc/sc/images/games/GTAV/map/game/${ZOOM}`;
// The map's tile bbox at zoom 4 is x[0..7] y[0..10]; every higher zoom doubles
// it and covers the EXACT same world extent, so the projection constants in
// mapRender.ts stay valid regardless of zoom. Compute the bbox directly to avoid
// a slow/flaky probe.
const F = 2 ** Math.max(0, ZOOM - 4);
const XMIN = 0, YMIN = 0, XMAX = 8 * F - 1, YMAX = 11 * F - 1;

async function run(args, timeout = 120000) {
  const { stdout } = await execFileAsync(browseBin, args, { timeout, maxBuffer: 512 * 1024 * 1024 });
  return stdout;
}
function parseEval(stdout) {
  const t = stdout.trim();
  try {
    const p = JSON.parse(t);
    if (p && typeof p === "object" && "result" in p) return typeof p.result === "string" ? p.result : JSON.stringify(p.result);
  } catch {}
  return t;
}
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function main() {
  console.error(`Opening gtalens for tile access; zoom ${ZOOM}...`);
  await run(["stop"]).catch(() => {});
  await run(["open", "https://gtalens.com/map", "--wait", "domcontentloaded"], 90000);

  console.error(`Discovering tile grid (range +/-${RANGE})...`);
  const discoverExpr = `(async () => {
    const valid = [];
    const ps = [];
    for (let x = -${RANGE}; x <= ${RANGE}; x++) for (let y = -${RANGE}; y <= ${RANGE}; y++) {
      ps.push(fetch("${BASE}/" + x + "/" + y + ".jpg", { method: "HEAD" }).then(r => { if (r.ok) { const len = +(r.headers.get("content-length") || 0); if (len > 1500) valid.push([x, y]); } }).catch(() => {}));
    }
    await Promise.all(ps);
    return JSON.stringify(valid);
  })()`;
  const valid = JSON.parse(parseEval(await run(["eval", discoverExpr], 120000)));
  if (!valid.length) throw new Error("no tiles discovered");
  const xs = valid.map((t) => t[0]), ys = valid.map((t) => t[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const cols = xmax - xmin + 1, rows = ymax - ymin + 1;
  console.error(`Grid: x[${xmin}..${xmax}] y[${ymin}..${ymax}] = ${cols}x${rows} tiles (${valid.length} non-empty), ${cols * TILE}x${rows * TILE}px`);
  // Fetch EVERY tile in the bbox (ocean tiles are valid map, not empty) to avoid gaps.
  const allTiles = [];
  for (let x = xmin; x <= xmax; x++) for (let y = ymin; y <= ymax; y++) allTiles.push([x, y]);
  valid.length = 0;
  valid.push(...allTiles);

  const canvas = createCanvas(cols * TILE, rows * TILE);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0fa8d2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let done = 0;
  for (const batch of chunk(valid, 40)) {
    const fetchExpr = `(async () => {
      const out = {};
      await Promise.all(${JSON.stringify(batch)}.map(([x, y]) =>
        fetch("${BASE}/" + x + "/" + y + ".jpg").then(r => r.ok ? r.blob() : null).then(b => b ? new Promise(res => { const fr = new FileReader(); fr.onloadend = () => res([x + "_" + y, fr.result]); fr.readAsDataURL(b); }) : null).catch(() => null)
      )).then(rs => rs.forEach(e => { if (e) out[e[0]] = e[1]; }));
      return JSON.stringify(out);
    })()`;
    const tiles = JSON.parse(parseEval(await run(["eval", fetchExpr], 120000)));
    for (const key of Object.keys(tiles)) {
      const [x, y] = key.split("_").map(Number);
      const img = await loadImage(tiles[key]);
      ctx.drawImage(img, (x - xmin) * TILE, (y - ymin) * TILE, TILE, TILE);
    }
    done += Object.keys(tiles).length;
    console.error(`  assembled ${done}/${valid.length} tiles`);
  }

  writeFileSync(resolve(dataDir, "basemap.jpg"), canvas.toBuffer("image/jpeg", 0.92));
  writeFileSync(
    resolve(dataDir, "basemap-meta.json"),
    JSON.stringify({ source: "s.rsg.sc GTAV game tiles", zoom: ZOOM, tile: TILE, xmin, xmax, ymin, ymax, width: cols * TILE, height: rows * TILE }, null, 2),
  );
  console.error(`Wrote data/basemap.jpg (${canvas.width}x${canvas.height}) + basemap-meta.json`);
}

main().catch((err) => {
  console.error("build-basemap failed:", err.message);
  process.exit(1);
});

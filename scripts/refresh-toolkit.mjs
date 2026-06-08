// Refresh data/toolkit-data.json from gtaweb's embedded TOOLKIT_DATA using the
// `browse` CLI (one-time / periodic; runtime stays browser-free). Run:
//   npm run refresh:toolkit
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "data", "toolkit-data.json");
const browseBin = process.env.BROWSE_BIN || "browse";
const URL = "https://gtaweb.eu/gtao-map/ls/0";

function extractObj(html, varname) {
  let i = html.indexOf(varname + " =");
  if (i < 0) i = html.indexOf(varname + "=");
  if (i < 0) return null;
  const j = html.indexOf("{", i);
  let depth = 0, instr = false, esc = false;
  for (let k = j; k < html.length; k++) {
    const c = html[k];
    if (esc) esc = false;
    else if (c === "\\") esc = true;
    else if (c === '"') instr = !instr;
    else if (!instr) {
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) return html.slice(j, k + 1); }
    }
  }
  return null;
}

async function run(args, timeout = 60000) {
  const { stdout } = await execFileAsync(browseBin, args, { timeout, maxBuffer: 256 * 1024 * 1024 });
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

async function main() {
  console.error(`Opening ${URL} ...`);
  await run(["stop"]).catch(() => {});
  await run(["open", URL, "--wait", "domcontentloaded"], 90000);
  const html = parseEval(await run(["eval", "document.documentElement.outerHTML"], 60000));
  const obj = extractObj(html, "TOOLKIT_DATA");
  if (!obj) throw new Error("TOOLKIT_DATA not found in page source");
  const data = JSON.parse(obj);
  writeFileSync(out, JSON.stringify(data, null, 1));
  console.error(`Wrote ${out} (week ${data?.static?.weeklies?.week}).`);
}

main().catch((err) => {
  console.error("refresh:toolkit failed:", err.message);
  process.exit(1);
});

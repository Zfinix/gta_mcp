// Loader for gtaweb's TOOLKIT_DATA economy dataset (bundled snapshot in
// data/toolkit-data.json). Refresh it with `npm run refresh:toolkit`. This gives
// current per-business production economics, mansion boost, high-demand bonus
// coefficients, and weekly/daily reset timing — all offline at runtime.
import { readFileSync } from "node:fs";
import { config } from "../config.js";

let cached: any;

export function getToolkit(): any {
  if (cached) return cached;
  cached = JSON.parse(readFileSync(config.toolkitPath, "utf8"));
  return cached;
}

export const BUSINESS_KEYS: Record<string, string> = {
  acid: "Acid Lab",
  bunk: "Bunker",
  coke: "Cocaine Lockup",
  meth: "Meth Lab",
  cash: "Counterfeit Cash",
  weed: "Weed Farm",
  docs: "Document Forgery",
};

export interface Economics {
  key: string;
  name: string;
  /** seconds (or game-time units) to produce one unit */
  unitTime: number;
  /** GTA$ per unit (local sell) */
  unitValue: number;
  capacity: number;
  fullValueLocal: number;
  /** mansion production speed multiplier (e.g. 3 = 3x) */
  mansionMultiplier: number;
  /** high-demand bonus: percent per rival player and player cap */
  highDemandPerPlayer: number;
  highDemandCap: number;
  maxHighDemandPct: number;
}

export function getEconomics(key: string): Economics | undefined {
  const t = getToolkit();
  const mc = t?.current?.mc?.[key];
  if (!mc) return undefined;
  const hdKeyMap: Record<string, string> = {
    acid: "acid",
    bunk: "bunk",
    coke: "mc",
    meth: "mc",
    cash: "mc",
    weed: "mc",
    docs: "mc",
  };
  const hd = t?.current?.hdbc?.[hdKeyMap[key] ?? "mc"] ?? {
    per: "2.5",
    cap: "20",
  };
  const per = Number(hd.per);
  const cap = Number(hd.cap);
  const unitValue = Number(mc.value);
  const capacity = Number(mc.capacity);
  return {
    key,
    name: BUSINESS_KEYS[key] ?? key,
    unitTime: Number(mc.time),
    unitValue,
    capacity,
    fullValueLocal: unitValue * capacity,
    mansionMultiplier: Number(mc.mansion) || 1,
    highDemandPerPlayer: per,
    highDemandCap: cap,
    maxHighDemandPct: per * cap,
  };
}

export function allEconomics(): Economics[] {
  return Object.keys(BUSINESS_KEYS)
    .map((k) => getEconomics(k))
    .filter((e): e is Economics => !!e);
}

export function weeklyInfo(): { week: number; next: number } | undefined {
  const w = getToolkit()?.static?.weeklies;
  return w ? { week: Number(w.week), next: Number(w.next) } : undefined;
}

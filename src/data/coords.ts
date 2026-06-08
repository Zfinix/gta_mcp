// Loader for bundled coordinate datasets used by the offline map renderer.
// Each data/coords/<category>.json holds points in game-world coordinates.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";
import type { MapPoint } from "../lib/mapRender.js";

export interface CoordSet {
  category: string;
  name: string;
  source?: string;
  points: MapPoint[];
}

function coordsDir(): string {
  return resolve(config.dataDir, "coords");
}

export function listCoordSets(): {
  category: string;
  name: string;
  count: number;
}[] {
  const dir = coordsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        const c = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as CoordSet;
        return { category: c.category, name: c.name, count: c.points.length };
      } catch {
        return null;
      }
    })
    .filter((x): x is { category: string; name: string; count: number } => !!x);
}

export function getCoordSet(category: string): CoordSet | undefined {
  const dir = coordsDir();
  const q = category.toLowerCase();
  const file = resolve(dir, `${q}.json`);
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, "utf8")) as CoordSet;
  }
  // fuzzy: match by category field
  for (const f of existsSync(dir) ? readdirSync(dir) : []) {
    if (!f.endsWith(".json")) continue;
    try {
      const c = JSON.parse(readFileSync(resolve(dir, f), "utf8")) as CoordSet;
      if (
        c.category.toLowerCase() === q ||
        c.category.toLowerCase().includes(q)
      )
        return c;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

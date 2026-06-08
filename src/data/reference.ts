// Typed loader for the bundled static reference data (data/reference.json at the
// repo root). Loaded once and cached for the process lifetime.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";
import type { ReferenceData, Method, Business, Collectible, MapCategory } from "../types.js";

let cached: ReferenceData | undefined;
let mapCached: MapCategory[] | undefined;

export function getReference(): ReferenceData {
  if (cached) return cached;
  cached = JSON.parse(readFileSync(config.referencePath, "utf8")) as ReferenceData;
  return cached;
}

export function getMapCategories(): MapCategory[] {
  if (mapCached) return mapCached;
  const path = resolve(config.dataDir, "map-categories.json");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { categories: MapCategory[] };
  mapCached = parsed.categories;
  return mapCached;
}

export function findMapCategory(idOrName: string): MapCategory | undefined {
  const cats = getMapCategories();
  const q = idOrName.toLowerCase().replace(/\s+/g, "-");
  const qn = idOrName.toLowerCase();
  return (
    cats.find((c) => c.slug === q) ||
    cats.find((c) => c.name.toLowerCase() === qn) ||
    cats.find((c) => c.name.toLowerCase().includes(qn)) ||
    cats.find((c) => c.slug.includes(q))
  );
}

export function findMethod(idOrName: string): Method | undefined {
  const ref = getReference();
  const q = idOrName.toLowerCase();
  return (
    ref.methods.find((m) => m.id === q) ||
    ref.methods.find((m) => m.name.toLowerCase().includes(q)) ||
    ref.methods.find((m) => m.id.includes(q))
  );
}

export function findBusiness(idOrName: string): Business | undefined {
  const ref = getReference();
  const q = idOrName.toLowerCase();
  return (
    ref.businesses.find((b) => b.id === q) ||
    ref.businesses.find((b) => b.name.toLowerCase().includes(q)) ||
    ref.businesses.find((b) => b.id.includes(q))
  );
}

export function findCollectible(idOrName: string): Collectible | undefined {
  const ref = getReference();
  const q = idOrName.toLowerCase();
  return (
    ref.collectibles.find((c) => c.id === q) ||
    ref.collectibles.find((c) => c.name.toLowerCase().includes(q)) ||
    ref.collectibles.find((c) => (c.gtalensSlug ?? "").includes(q))
  );
}

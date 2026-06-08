// Persistent player business state for the "run my businesses" feature.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.js";
import type { BusinessState, OwnedBusiness } from "../types.js";

function emptyState(): BusinessState {
  return { businesses: {}, updatedAt: new Date().toISOString() };
}

export function loadState(): BusinessState {
  try {
    if (!existsSync(config.statePath)) return emptyState();
    const parsed = JSON.parse(readFileSync(config.statePath, "utf8")) as BusinessState;
    if (!parsed.businesses) return emptyState();
    return parsed;
  } catch (err) {
    console.error("[state] load failed, starting fresh:", err);
    return emptyState();
  }
}

export function saveState(state: BusinessState): void {
  state.updatedAt = new Date().toISOString();
  const dir = dirname(config.statePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(config.statePath, JSON.stringify(state, null, 2), "utf8");
}

/** Upsert one owned business, merging with any existing tracked fields. */
export function upsertBusiness(state: BusinessState, biz: OwnedBusiness): BusinessState {
  state.businesses[biz.id] = { ...state.businesses[biz.id], ...biz };
  return state;
}

export function removeBusiness(state: BusinessState, id: string): boolean {
  if (!state.businesses[id]) return false;
  delete state.businesses[id];
  return true;
}

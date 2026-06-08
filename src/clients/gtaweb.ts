// gtaweb.eu client. The site is Cloudflare-protected, so all requests go through
// the browser fallback. Endpoints verified by live network capture:
//   /_sources/php/check-tunables          -> per-platform daily-update timestamps
//   /_sources/tunables_utils/MapConfig     -> marker category tree
import { browseFetchJson, browseFetchText } from "../lib/browseFallback.js";

const BASE = "https://gtaweb.eu";

export interface TunablesStatus {
  modified: Record<string, number>;
  unhashed: Record<string, number>;
}

/** Per-platform timestamps of the last tunables update (daily-reset signal). */
export async function getTunablesStatus(): Promise<TunablesStatus> {
  return browseFetchJson<TunablesStatus>(`${BASE}/_sources/php/check-tunables`);
}

/** Map marker category configuration. */
export async function getMapConfig(lang = "en"): Promise<unknown> {
  return browseFetchJson(
    `${BASE}/_sources/tunables_utils/MapConfig?lang=${lang}`,
  );
}

/**
 * Today's daily marker positions are derived from the decoded Rockstar tunables.
 * The exact per-category data endpoint is a discovery item (toggle a layer with
 * `browse network on` to capture it). Until mapped, we surface the tunables
 * freshness + the live map URL so the tool degrades gracefully instead of failing.
 */
export interface DailyCollectibleInfo {
  status: TunablesStatus;
  mapUrl: string;
  note: string;
}

export async function getDailyCollectibles(): Promise<DailyCollectibleInfo> {
  const status = await getTunablesStatus();
  return {
    status,
    mapUrl: `${BASE}/gtao-map`,
    note:
      "Today's exact collectible/Cayo-target coordinates are decoded from Rockstar tunables. " +
      "Open the map URL for live positions; the per-category coordinate endpoint is pending discovery.",
  };
}

/** Raw passthrough for ad-hoc gtaweb endpoints (used during endpoint discovery). */
export async function getRaw(path: string): Promise<string> {
  return browseFetchText(`${BASE}${path}`);
}

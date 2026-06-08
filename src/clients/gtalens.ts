// gtalens.com tRPC client. Verified working with plain fetch (HTTP 200).
// Endpoint shape: GET /api/v2/<router>.<procedure> -> {"result":{"data":{...}}}
import { fetchJson } from "../lib/http.js";

const BASE = "https://gtalens.com/api/v2";

interface TrpcEnvelope<T> {
  result?: { data?: T };
  error?: unknown;
}

/** Call a tRPC query procedure and unwrap result.data. */
export async function trpcQuery<T = unknown>(
  router: string,
  procedure: string,
  input?: unknown,
): Promise<T> {
  let url = `${BASE}/${router}.${procedure}`;
  if (input !== undefined) {
    url += `?input=${encodeURIComponent(JSON.stringify(input))}`;
  }
  const env = await fetchJson<TrpcEnvelope<T>>(url);
  if (env.error)
    throw new Error(`gtalens tRPC error for ${router}.${procedure}`);
  if (!env.result || env.result.data === undefined) {
    throw new Error(`gtalens tRPC empty result for ${router}.${procedure}`);
  }
  return env.result.data;
}

/** Known-good procedure: all job tags (used as a connectivity probe). */
export async function getAllJobTags(): Promise<unknown> {
  return trpcQuery("jobTag", "getAllTags");
}

/**
 * Static collectible location lookup. gtalens renders these from its JS bundle
 * rather than a per-category API, so the map page is the canonical source. We
 * return the canonical gtalens map URL plus any tRPC data we can surface, so the
 * tool is always useful even before the exact procedure name is mapped.
 */
export function mapUrlForSlug(slug: string): string {
  return `https://gtalens.com/map/${slug}`;
}

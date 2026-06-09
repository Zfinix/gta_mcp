// r/gtaonline community client. Reddit exposes public listing JSON at
// <subreddit>/{hot,top,new}.json plus a search endpoint; we normalize posts to
// surface community signal — what people are actually grinding, sentiment on the
// weekly event, and the pinned megathreads — alongside the official Newswire
// data. Best-effort with graceful fallback.
import { fetchJson } from "../lib/http.js";
import { browseFetchJson } from "../lib/browseFallback.js";

const SUB = "gtaonline";
const BASE = `https://www.reddit.com/r/${SUB}`;
// Reddit rate-limits/blocks generic browser UAs on the .json endpoints; identify
// the client explicitly per Reddit's API etiquette.
const REDDIT_UA = "gta-mcp:money-copilot:1.0 (by /u/gta-mcp)";

export type Sort = "hot" | "top" | "new";
export type TimeRange = "day" | "week" | "month";

export interface CommunityPost {
  title: string;
  url: string; // permalink to the discussion thread
  link: string; // outbound link (equals url for self/text posts)
  score: number;
  comments: number;
  flair?: string;
  author: string;
  createdUtc: number;
  stickied: boolean;
  selftext: string; // trimmed self-post body
}

interface RedditChild {
  kind: string;
  data: {
    title: string;
    permalink: string;
    url: string;
    score: number;
    num_comments: number;
    link_flair_text?: string | null;
    author: string;
    created_utc: number;
    stickied: boolean;
    selftext?: string;
    over_18?: boolean;
  };
}

interface Listing {
  data?: { children?: RedditChild[] };
}

function normalize(c: RedditChild): CommunityPost {
  const d = c.data;
  return {
    title: d.title?.trim() ?? "",
    url: `https://www.reddit.com${d.permalink}`,
    link: d.url || `https://www.reddit.com${d.permalink}`,
    score: d.score ?? 0,
    comments: d.num_comments ?? 0,
    flair: d.link_flair_text?.trim() || undefined,
    author: d.author ?? "[unknown]",
    createdUtc: d.created_utc ?? 0,
    stickied: Boolean(d.stickied),
    selftext: (d.selftext ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
  };
}

async function listing(path: string): Promise<CommunityPost[]> {
  const url = `${BASE}/${path}`;
  let res: Listing;
  try {
    res = await fetchJson<Listing>(url, {
      userAgent: REDDIT_UA,
      accept: "application/json",
    });
  } catch {
    // Reddit blocks plain-HTTP access to the .json endpoints (403); a real
    // browser session is allowed, so fall back to it like the other sources.
    res = await browseFetchJson<Listing>(url);
  }
  return (res.data?.children ?? [])
    .filter((c) => c.kind === "t3" && !c.data.over_18)
    .map(normalize);
}

export async function getCommunityPosts(
  opts: { sort?: Sort; time?: TimeRange; limit?: number } = {},
): Promise<CommunityPost[]> {
  const sort = opts.sort ?? "hot";
  const limit = Math.min(Math.max(opts.limit ?? 15, 1), 50);
  const params = new URLSearchParams({ limit: String(limit), raw_json: "1" });
  if (sort === "top") params.set("t", opts.time ?? "week");
  return listing(`${sort}.json?${params.toString()}`);
}

export async function searchCommunity(
  query: string,
  opts: { time?: TimeRange; limit?: number } = {},
): Promise<CommunityPost[]> {
  const limit = Math.min(Math.max(opts.limit ?? 15, 1), 50);
  const params = new URLSearchParams({
    q: query,
    restrict_sr: "1",
    sort: "relevance",
    t: opts.time ?? "month",
    limit: String(limit),
    raw_json: "1",
  });
  return listing(`search.json?${params.toString()}`);
}

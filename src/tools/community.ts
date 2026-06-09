import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getCommunityPosts,
  searchCommunity,
  type CommunityPost,
} from "../clients/reddit.js";
import { withCache } from "../lib/cache.js";
import { currentDailyWindowKey } from "../lib/resets.js";
import { text } from "../lib/format.js";

const COMMUNITY_NOTE =
  "Community signal from r/gtaonline — useful for sentiment, what people are grinding, and corroborating an event. It is NOT authoritative for the exact weekly multiplier or podium; use `gta-weekly-bonuses` (Newswire) for that.";

function relativeAge(createdUtc: number, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - createdUtc * 1000) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderPost(p: CommunityPost): string {
  const flair = p.flair ? ` [${p.flair}]` : "";
  const head = `- ${p.score}↑ ${p.comments}💬${flair} ${p.title} · u/${p.author} · ${relativeAge(p.createdUtc)}`;
  const body = p.selftext ? `\n  ${p.selftext}` : "";
  return `${head}\n  ${p.url}${body}`;
}

function renderList(posts: CommunityPost[]): string {
  return posts.length
    ? posts.map(renderPost).join("\n")
    : "(no posts returned)";
}

export function registerCommunityTools(server: McpServer): void {
  server.registerTool(
    "gta-community-pulse",
    {
      description:
        "What r/gtaonline is talking about right now: top/hot threads and the pinned megathreads (daily simple-question, weekly event discussion). Community sentiment and what players are actually grinding. Cached ~15 min; serves stale with a note if Reddit fails. Not authoritative for the weekly multiplier — use gta-weekly-bonuses for that.",
      inputSchema: {
        sort: z
          .enum(["hot", "top", "new"])
          .optional()
          .describe("Listing to pull (default hot)."),
        time: z
          .enum(["day", "week", "month"])
          .optional()
          .describe("Time window for top sort (default week)."),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ sort, time, limit }) => {
      const params = { sort: sort ?? "hot", time: time ?? "week", limit: limit ?? 15 };
      try {
        const res = await withCache(
          "reddit-pulse",
          currentDailyWindowKey(),
          15 * 60000,
          () => getCommunityPosts(params),
          params,
        );
        const posts = res.value;
        const pinned = posts.filter((p) => p.stickied);
        const rest = posts.filter((p) => !p.stickied);
        const freshness = res.fresh
          ? ""
          : "\n\n⚠️ Live fetch failed; showing the last cached pulse.";
        return text(
          [
            `# r/gtaonline — ${params.sort}${params.sort === "top" ? ` (${params.time})` : ""}`,
            pinned.length ? "\nPinned megathreads:" : null,
            pinned.length ? renderList(pinned) : null,
            "\nThreads:",
            renderList(rest),
            "",
            COMMUNITY_NOTE + freshness,
          ]
            .filter((l) => l !== null)
            .join("\n"),
        );
      } catch (err) {
        return text(
          `Community pulse unavailable: ${(err as Error).message}.\n` +
            "Open https://www.reddit.com/r/gtaonline for the latest, or retry. Other tools still work.",
        );
      }
    },
  );

  server.registerTool(
    "gta-community-search",
    {
      description:
        "Search r/gtaonline for community takes on a specific topic — e.g. whether a method is worth it this week, is a business setup still good, real-world payouts, bug/glitch reports. Returns the most relevant threads. Cached ~15 min per query.",
      inputSchema: {
        query: z
          .string()
          .min(2)
          .describe("Topic to search, e.g. 'cayo solo time' or 'acid lab worth it'."),
        time: z
          .enum(["day", "week", "month"])
          .optional()
          .describe("Recency window (default month)."),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    async ({ query, time, limit }) => {
      const params = { query, time: time ?? "month", limit: limit ?? 12 };
      try {
        const res = await withCache(
          "reddit-search",
          currentDailyWindowKey(),
          15 * 60000,
          () => searchCommunity(params.query, { time: params.time, limit: params.limit }),
          params,
        );
        const freshness = res.fresh
          ? ""
          : "\n\n⚠️ Live fetch failed; showing the last cached results.";
        return text(
          [
            `# r/gtaonline search: "${query}" (${params.time})`,
            "",
            renderList(res.value),
            "",
            COMMUNITY_NOTE + freshness,
          ].join("\n"),
        );
      } catch (err) {
        return text(
          `Community search unavailable: ${(err as Error).message}.\n` +
            `Open https://www.reddit.com/r/gtaonline/search?q=${encodeURIComponent(query)}&restrict_sr=1 to search manually.`,
        );
      }
    },
  );
}

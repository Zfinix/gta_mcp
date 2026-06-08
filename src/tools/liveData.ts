import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  nextDailyReset,
  nextWeeklyReset,
  msUntil,
  formatDuration,
  currentWeeklyWindowKey,
  currentDailyWindowKey,
} from "../lib/resets.js";
import { getTunablesStatus } from "../clients/gtaweb.js";
import { getWeeklyUpdate } from "../clients/newswire.js";
import { withCache } from "../lib/cache.js";
import { text } from "../lib/format.js";

export function registerLiveDataTools(server: McpServer): void {
  server.registerTool(
    "gta-reset-times",
    {
      description:
        "Time remaining until the GTA Online daily reset (06:00 UTC) and weekly reset (Thursday 07:00 UTC). Pure computation, always available.",
      inputSchema: {},
    },
    async () => {
      const now = new Date();
      const daily = nextDailyReset(now);
      const weekly = nextWeeklyReset(now);
      return text(
        [
          `Current UTC: ${now.toUTCString()}`,
          `Daily reset (collectibles, objectives, Most Wanted) in ${formatDuration(msUntil(daily, now))} — ${daily.toUTCString()}`,
          `Weekly reset (event, podium, prize ride) in ${formatDuration(msUntil(weekly, now))} — ${weekly.toUTCString()}`,
          "",
          "Tip: do daily-reset-bound tasks (collectibles, daily Cayo target) before the daily reset, and time big sells for whatever's 2x this week before the weekly reset.",
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "gta-tunables-status",
    {
      description:
        "Per-platform timestamps of the last GTA Online tunables update from gtaweb (a daily-reset / new-content signal). Requires the browser fallback; degrades gracefully if unavailable.",
      inputSchema: {
        platform: z
          .enum(["pcros", "pcrosalt", "ps4", "ps5", "xboxone", "xboxsx"])
          .optional(),
      },
    },
    async ({ platform }) => {
      try {
        const res = await withCache(
          "gtaweb-tunables",
          currentDailyWindowKey(),
          10 * 60000,
          getTunablesStatus,
        );
        const mod = res.value.modified;
        const entries = Object.entries(mod)
          .filter(([k]) => !platform || k === platform)
          .map(([k, v]) => `- ${k}: ${new Date(v * 1000).toUTCString()}`)
          .join("\n");
        const freshness = res.fresh ? "" : "\n(⚠️ cached — live fetch failed)";
        return text(
          `Tunables last modified per platform:\n${entries}${freshness}`,
        );
      } catch (err) {
        return text(
          `Tunables status unavailable: ${(err as Error).message}.\n` +
            "This source needs the `browse` CLI (BROWSE_FALLBACK=1). Other tools still work.",
        );
      }
    },
  );

  server.registerTool(
    "gta-weekly-bonuses",
    {
      description:
        "This week's GTA Online event from the Rockstar Newswire: the weekly update title, 2x/3x bonus activities, podium vehicle, and discounts. Cached per weekly window; serves stale data with a note if the fetch fails.",
      inputSchema: {},
    },
    async () => {
      try {
        const ttl = Math.max(60 * 60000, msUntil(nextWeeklyReset()));
        const res = await withCache(
          "newswire-weekly",
          currentWeeklyWindowKey(),
          ttl,
          getWeeklyUpdate,
        );
        const w = res.value;
        const bonuses = w.bonuses.length
          ? w.bonuses.map((b) => `- ${b}`).join("\n")
          : "(Could not parse individual bonus lines — open the article for the full list.)";
        const freshness = res.fresh
          ? ""
          : "\n\n⚠️ Live fetch failed; showing the last cached weekly update.";
        const window =
          w.startDate && w.endDate
            ? `Active: ${w.startDate.slice(0, 10)} → ${w.endDate.slice(0, 10)}`
            : null;
        return text(
          [
            `# ${w.title}`,
            window,
            w.podiumVehicle ? `Podium vehicle: ${w.podiumVehicle}` : null,
            "",
            "Bonuses / highlights:",
            bonuses,
            "",
            `Source: ${w.url}${freshness}`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      } catch (err) {
        return text(
          `Weekly bonuses unavailable: ${(err as Error).message}.\n` +
            "Open https://www.rockstargames.com/newswire for the latest weekly update, or retry.",
        );
      }
    },
  );
}

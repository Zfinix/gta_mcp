import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getReference, findCollectible } from "../data/reference.js";
import { mapUrlForSlug } from "../clients/gtalens.js";
import { getDailyCollectibles } from "../clients/gtaweb.js";
import { withCache } from "../lib/cache.js";
import {
  currentDailyWindowKey,
  nextDailyReset,
  msUntil,
} from "../lib/resets.js";
import { money, text } from "../lib/format.js";

export function registerCollectibleTools(server: McpServer): void {
  server.registerTool(
    "gta-collectible-locations",
    {
      description:
        "Get the GTALens map link and reward info for a GTA Online collectible (all static spawn locations). Examples: gs-caches, hidden-caches, shipwrecks, signal-jammers, playing-cards.",
      inputSchema: {
        type: z
          .string()
          .describe(
            "Collectible id or slug, e.g. gs-caches, hidden-caches, signal-jammers",
          ),
      },
    },
    async ({ type }) => {
      const c = findCollectible(type);
      const ref = getReference();
      if (!c) {
        const ids = ref.collectibles
          .map((x) => x.gtalensSlug ?? x.id)
          .join(", ");
        return text(`No collectible matching "${type}". Try one of: ${ids}`);
      }
      const slug = c.gtalensSlug ?? c.id;
      const reward =
        c.kind === "daily"
          ? `Daily: ${c.countPerDay}/day at ${money(c.payoutEach ?? 0)} each = ${money(c.dailyTotal ?? 0)}/day`
          : `One-time set of ${c.count}: ${money(c.rewardTotal ?? 0)} total`;
      return text(
        [
          `# ${c.name}`,
          reward,
          c.notes,
          "",
          `All locations (GTALens): ${mapUrlForSlug(slug)}`,
          c.kind === "daily"
            ? "Today's specific spawn: use gta-daily-collectibles."
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "gta-daily-collectibles",
    {
      description:
        "Today's GTA Online daily collectible income: the per-day reward table plus live tunables freshness (which day's data is loaded) from gtaweb. Falls back to the reference table if the live source is unavailable.",
      inputSchema: {},
    },
    async () => {
      const ref = getReference();
      const daily = ref.collectibles.filter((c) => c.kind === "daily");
      const total = daily.reduce((s, c) => s + (c.dailyTotal ?? 0), 0);
      const table = daily
        .map(
          (c) =>
            `- ${c.name}: ${c.countPerDay}/day × ${money(c.payoutEach ?? 0)} = ${money(c.dailyTotal ?? 0)}`,
        )
        .join("\n");

      let live = "";
      try {
        const ttl = Math.max(10 * 60000, msUntil(nextDailyReset()));
        const res = await withCache(
          "gtaweb-daily",
          currentDailyWindowKey(),
          ttl,
          getDailyCollectibles,
        );
        const ts = res.value.status.modified;
        const newest = Math.max(...Object.values(ts));
        live =
          `\nLive: tunables last updated ${new Date(newest * 1000).toUTCString()} ` +
          `(${res.fresh ? "fresh" : "cached"}). Map: ${res.value.mapUrl}\n${res.value.note}`;
      } catch (err) {
        live = `\n(Live tunables unavailable: ${(err as Error).message}. Showing the reference table — open https://gtaweb.eu/gtao-map for today's exact positions.)`;
      }

      return text(
        `Daily collectibles (reset 06:00 UTC) — ~${money(total)}/day if you clear them all:\n\n${table}\n${live}`,
      );
    },
  );
}

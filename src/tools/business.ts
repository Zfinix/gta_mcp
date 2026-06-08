import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getReference, findBusiness } from "../data/reference.js";
import {
  loadState,
  saveState,
  upsertBusiness,
  removeBusiness,
} from "../lib/state.js";
import { money, text, errorText } from "../lib/format.js";
import { formatDuration } from "../lib/resets.js";

function nowIso(): string {
  return new Date().toISOString();
}

/** Estimate current production fill 0..1 from the last resupply time. */
function currentFill(
  stockFractionAtResupply: number,
  lastResupplyAt: string | undefined,
  fillMinutes: number,
): number {
  if (!lastResupplyAt) return stockFractionAtResupply;
  const elapsedMin = (Date.now() - new Date(lastResupplyAt).getTime()) / 60000;
  return Math.min(1, stockFractionAtResupply + elapsedMin / fillMinutes);
}

export function registerBusinessTools(server: McpServer): void {
  server.registerTool(
    "gta-business-set-state",
    {
      description:
        "Record which GTA Online businesses you own and their current state (resupplied just now, sold just now, stock level, upgrades). Persists locally so the server tracks fill timers and cooldowns across sessions.",
      inputSchema: {
        businesses: z
          .array(
            z.object({
              id: z
                .string()
                .describe(
                  "Business id, e.g. acid-lab, bunker, cocaine, nightclub-warehouse",
                ),
              resupply: z
                .boolean()
                .optional()
                .describe("Mark resupplied/production started now"),
              sold: z
                .boolean()
                .optional()
                .describe("Mark sold now (resets stock to empty)"),
              stockFraction: z
                .number()
                .min(0)
                .max(1)
                .optional()
                .describe("Current stock as 0..1"),
              lastResupplyAt: z
                .string()
                .optional()
                .describe("ISO time override for last resupply"),
              upgraded: z
                .boolean()
                .optional()
                .describe("Has the production/equipment upgrade"),
              notes: z.string().optional(),
            }),
          )
          .optional(),
        remove: z
          .array(z.string())
          .optional()
          .describe("Business ids to stop tracking"),
      },
    },
    async ({ businesses, remove }) => {
      const state = loadState();
      const ref = getReference();
      const validIds = new Set(ref.businesses.map((b) => b.id));
      const unknown: string[] = [];

      for (const b of businesses ?? []) {
        if (!validIds.has(b.id)) {
          unknown.push(b.id);
          continue;
        }
        const patch: any = { id: b.id };
        if (b.resupply) patch.lastResupplyAt = nowIso();
        if (b.lastResupplyAt) patch.lastResupplyAt = b.lastResupplyAt;
        if (b.sold) {
          patch.lastSoldAt = nowIso();
          patch.stockFraction = 0;
          patch.lastResupplyAt = nowIso();
        }
        if (typeof b.stockFraction === "number")
          patch.stockFraction = b.stockFraction;
        if (typeof b.upgraded === "boolean") patch.upgraded = b.upgraded;
        if (b.notes) patch.notes = b.notes;
        upsertBusiness(state, patch);
      }

      const removed: string[] = [];
      for (const id of remove ?? []) {
        if (removeBusiness(state, id)) removed.push(id);
      }

      saveState(state);

      const owned = Object.keys(state.businesses);
      const lines = [
        `Tracking ${owned.length} business(es): ${owned.join(", ") || "(none)"}`,
        removed.length ? `Removed: ${removed.join(", ")}` : null,
        unknown.length
          ? `Ignored unknown ids: ${unknown.join(", ")} (see gta-best-methods for valid ids)`
          : null,
        "Use gta-business-status to see fill timers and sell recommendations.",
      ].filter(Boolean);
      return text(lines.join("\n"));
    },
  );

  server.registerTool(
    "gta-business-status",
    {
      description:
        "Show the current state of your tracked GTA Online businesses: estimated stock %, time-to-full, current value, sell readiness, and what to do next. Reads persisted state set via gta-business-set-state.",
      inputSchema: {},
    },
    async () => {
      const state = loadState();
      const owned = Object.values(state.businesses);
      if (!owned.length) {
        return text(
          "No businesses tracked yet. Use gta-business-set-state to record what you own (id + resupply:true).",
        );
      }

      const rows: string[] = [];
      const sellNow: string[] = [];
      for (const ob of owned) {
        const ref = findBusiness(ob.id);
        if (!ref) continue;
        const fill = currentFill(
          ob.stockFraction ?? 0,
          ob.lastResupplyAt,
          ref.fillMinutes,
        );
        const pct = Math.round(fill * 100);
        const value = Math.round(ref.fullValueFar * fill);
        const remainingMin = Math.max(0, ref.fillMinutes * (1 - fill));
        const overSoloLimit = value > ref.soloSellLimitValue;
        const ready = fill >= 0.95;

        const status = ready
          ? "FULL — sell now"
          : `${pct}% (full in ${formatDuration(remainingMin * 60000)})`;
        const sellFlag = overSoloLimit
          ? " ⚠️ exceeds solo 1-vehicle limit — sell before it overfills"
          : "";
        rows.push(
          `- ${ref.name}: ${status} · ~${money(value)}${sellFlag}` +
            (ob.lastSoldAt ? `\n  last sold ${timeAgo(ob.lastSoldAt)}` : ""),
        );
        if (ready || overSoloLimit) sellNow.push(ref.name);
      }

      const footer = sellNow.length
        ? `\nSell now: ${sellNow.join(", ")}. Check gta-weekly-bonuses first — selling on a 2x week is worth far more.`
        : "\nNothing ready to sell yet. Keep doing active content (Cayo/Agency) while these fill.";
      return text(`Business status:\n\n${rows.join("\n")}\n${footer}`);
    },
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  return `${formatDuration(ms)} ago`;
}

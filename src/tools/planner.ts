import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getReference, findBusiness } from "../data/reference.js";
import { loadState } from "../lib/state.js";
import { getWeeklyUpdate } from "../clients/newswire.js";
import { withCache } from "../lib/cache.js";
import {
  nextDailyReset,
  nextWeeklyReset,
  msUntil,
  formatDuration,
  currentWeeklyWindowKey,
} from "../lib/resets.js";
import { money, text } from "../lib/format.js";

interface Action {
  title: string;
  why: string;
  estPayout: number;
  estMinutes: number;
  urgency: "now" | "high" | "normal";
  score: number;
}

function currentFill(stockFractionAtResupply: number, lastResupplyAt: string | undefined, fillMinutes: number): number {
  if (!lastResupplyAt) return stockFractionAtResupply;
  const elapsedMin = (Date.now() - new Date(lastResupplyAt).getTime()) / 60000;
  return Math.min(1, stockFractionAtResupply + elapsedMin / fillMinutes);
}

export function registerPlannerTool(server: McpServer): void {
  server.tool(
    "gta-money-plan",
    "The flagship planner: given your session length and goal, build a ranked, time-boxed action list that mixes passive business income with active earners so no time is wasted. Combines this week's bonuses, your tracked business state, and reset urgency.",
    {
      sessionMinutes: z.number().int().min(5).max(600).default(60).describe("How long you can play right now"),
      solo: z.boolean().default(true),
      goal: z.enum(["max-cash", "fast-cash", "collectibles", "balanced"]).default("balanced"),
    },
    async ({ sessionMinutes, solo, goal }) => {
      const ref = getReference();
      const state = loadState();
      const now = new Date();
      const dailyIn = msUntil(nextDailyReset(now), now);
      const weeklyIn = msUntil(nextWeeklyReset(now), now);

      // --- live weekly bonuses (best-effort) ---
      let weeklyText = "";
      let weeklyTitle = "";
      let weeklySource: string | null = null;
      let weeklyStale = false;
      try {
        const ttl = Math.max(60 * 60000, weeklyIn);
        const res = await withCache("newswire-weekly", currentWeeklyWindowKey(now), ttl, getWeeklyUpdate);
        weeklyTitle = res.value.title;
        weeklyText = `${res.value.title} ${res.value.bonuses.join(" ")}`.toLowerCase();
        weeklySource = res.value.url;
        weeklyStale = !res.fresh;
      } catch {
        weeklySource = null;
      }

      const bonusMultiplier = (name: string): number => {
        if (!weeklyText) return 1;
        const key = name.toLowerCase().split(" ")[0];
        return weeklyText.includes(key) ? 2 : 1;
      };

      // --- passive kickoff (background, ~minimal active time) ---
      const kickoff: string[] = [];
      kickoff.push("Activate the Mansion production boost on today's sell target (rotate daily) — if you own one.");
      const tracked = Object.values(state.businesses);
      const empties = tracked
        .map((ob) => ({ ob, ref: findBusiness(ob.id) }))
        .filter((x) => x.ref && currentFill(x.ob.stockFraction ?? 0, x.ob.lastResupplyAt, x.ref!.fillMinutes) < 0.1);
      if (empties.length) {
        kickoff.push(`Resupply: ${empties.map((e) => e.ref!.name).join(", ")} — start them producing before you do anything else.`);
      } else if (!tracked.length) {
        kickoff.push("Track your businesses with gta-business-set-state so this plan can manage resupply/sell timing.");
      }
      kickoff.push("Set Nightclub technicians to Coke/Meth/Cash and top up popularity.");

      // --- candidate actions ---
      const actions: Action[] = [];

      // Sells from tracked state
      for (const ob of tracked) {
        const b = findBusiness(ob.id);
        if (!b) continue;
        const fill = currentFill(ob.stockFraction ?? 0, ob.lastResupplyAt, b.fillMinutes);
        const value = Math.round(b.fullValueFar * fill);
        const overLimit = value > b.soloSellLimitValue;
        if (fill >= 0.6 || overLimit) {
          const mult = bonusMultiplier(b.name);
          actions.push({
            title: `Sell ${b.name}`,
            why: `${Math.round(fill * 100)}% full (~${money(value)})${mult > 1 ? " — 2x bonus this week!" : ""}${overLimit ? " — over the solo 1-vehicle limit" : ""}`,
            estPayout: value * mult,
            estMinutes: 12,
            urgency: overLimit ? "high" : "normal",
            score: 0,
          });
        }
      }

      // Active earners from reference
      for (const m of ref.methods) {
        if (solo && !m.solo) continue;
        if (m.estMinutes == null) continue;
        if (m.estMinutes > sessionMinutes) continue;
        const mult = bonusMultiplier(m.name);
        actions.push({
          title: m.name,
          why: `${money(m.estPerHour * mult)}/hr${mult > 1 ? " (2x this week!)" : ""} · ~${m.estMinutes} min`,
          estPayout: Math.round((m.estPerHour * mult * m.estMinutes) / 60),
          estMinutes: m.estMinutes,
          urgency: "normal",
          score: 0,
        });
      }

      // Daily collectibles
      const dailyTotal = ref.collectibles
        .filter((c) => c.kind === "daily")
        .reduce((s, c) => s + (c.dailyTotal ?? 0), 0);
      if (goal !== "max-cash" || dailyIn < 3 * 3600_000) {
        actions.push({
          title: "Run daily collectibles + empty safes",
          why: `~${money(dailyTotal)} of daily resets${dailyIn < 3 * 3600_000 ? " — resets soon, do these first!" : ""}`,
          estPayout: dailyTotal,
          estMinutes: 35,
          urgency: dailyIn < 3 * 3600_000 ? "now" : "normal",
          score: 0,
        });
      }

      // --- scoring by goal ---
      const perMin = (a: Action) => a.estPayout / Math.max(1, a.estMinutes);
      for (const a of actions) {
        let s = perMin(a);
        if (goal === "max-cash") s = a.estPayout;
        if (goal === "fast-cash") s = perMin(a) * (a.estMinutes <= 20 ? 1.5 : 1);
        if (goal === "collectibles") s = a.title.includes("collectibles") ? 1e9 : perMin(a);
        if (a.urgency === "now") s *= 3;
        if (a.urgency === "high") s *= 1.5;
        a.score = s;
      }
      actions.sort((a, b) => b.score - a.score);

      // --- fit to session (greedy) ---
      const plan: Action[] = [];
      let used = 0;
      const seen = new Set<string>();
      for (const a of actions) {
        if (seen.has(a.title)) continue;
        if (used + a.estMinutes > sessionMinutes && plan.length) continue;
        plan.push(a);
        seen.add(a.title);
        used += a.estMinutes;
        if (used >= sessionMinutes) break;
      }

      const totalEst = plan.reduce((s, a) => s + a.estPayout, 0);
      const urgencyTag = (u: Action["urgency"]) => (u === "now" ? "🔴 NOW" : u === "high" ? "🟠" : "");

      const planLines = plan.map(
        (a, i) => `${i + 1}. ${urgencyTag(a.urgency)} ${a.title} — ${a.why}\n   est. ${money(a.estPayout)} in ~${a.estMinutes} min`,
      );

      const footerBits: string[] = [];
      footerBits.push(`Daily reset in ${formatDuration(dailyIn)} · weekly reset in ${formatDuration(weeklyIn)}.`);
      if (weeklyTitle) footerBits.push(`This week: ${weeklyTitle}${weeklyStale ? " (cached)" : ""}.${weeklySource ? ` ${weeklySource}` : ""}`);
      else footerBits.push("⚠️ Could not load this week's bonuses — values not bonus-weighted. Check gta-weekly-bonuses.");

      return text(
        [
          `# Money plan — ${sessionMinutes} min, ${solo ? "solo" : "crew"}, goal: ${goal}`,
          `Est. total this session: ~${money(totalEst)} (active time ~${used} min)`,
          "",
          "## First: kick off passive income (runs in the background)",
          ...kickoff.map((k) => `- ${k}`),
          "",
          "## Then work this ranked list:",
          ...planLines,
          "",
          footerBits.join(" "),
        ].join("\n"),
      );
    },
  );
}

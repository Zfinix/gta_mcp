import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getReference, findMethod } from "../data/reference.js";
import { getEconomics, BUSINESS_KEYS } from "../clients/toolkit.js";
import { money, moneyRange, text, errorText } from "../lib/format.js";
import { formatDuration } from "../lib/resets.js";

function toBusinessKey(s: string): string | undefined {
  const q = s.toLowerCase();
  const direct = Object.keys(BUSINESS_KEYS).find((k) => q.startsWith(k) || k.startsWith(q.slice(0, 4)));
  if (direct) return direct;
  if (q.includes("acid")) return "acid";
  if (q.includes("bunk") || q.includes("gun")) return "bunk";
  if (q.includes("coc") || q.includes("coke")) return "coke";
  if (q.includes("meth")) return "meth";
  if (q.includes("counter") || q.includes("cash")) return "cash";
  if (q.includes("weed")) return "weed";
  if (q.includes("doc") || q.includes("forg")) return "docs";
  return undefined;
}

export function registerCalculatorTools(server: McpServer): void {
  server.tool(
    "gta-sell-calculator",
    "Calculate a GTA Online business sell value with the high-demand public-lobby bonus (+2.5%/rival player, cap +50%) and an optional weekly 2x/3x multiplier. Uses live economy data.",
    {
      business: z.string().describe("Business name (acid, bunker, cocaine, meth, counterfeit, weed, docs)"),
      players: z.number().int().min(0).max(29).default(0).describe("Rival players in the public lobby (0 = sell solo/private)"),
      bonusMultiplier: z.number().min(1).max(4).default(1).describe("Weekly event multiplier, e.g. 2 for a 2x week"),
    },
    async ({ business, players, bonusMultiplier }) => {
      const key = toBusinessKey(business);
      const econ = key ? getEconomics(key) : undefined;
      if (!econ) return errorText(`Unknown business "${business}". Valid: ${Object.values(BUSINESS_KEYS).join(", ")}`);
      const hdPct = Math.min(players * econ.highDemandPerPlayer, econ.maxHighDemandPct);
      const base = econ.fullValueLocal;
      const value = Math.round(base * (1 + hdPct / 100) * bonusMultiplier);
      return text(
        [
          `# ${econ.name} full sell estimate`,
          `Base (solo/private): ${money(base)}`,
          `High-demand bonus: +${hdPct}% (${players} rival players × ${econ.highDemandPerPlayer}%, cap +${econ.maxHighDemandPct}%)`,
          bonusMultiplier > 1 ? `Weekly event: ×${bonusMultiplier}` : null,
          ``,
          `Estimated payout: ${money(value)}`,
          players > 0
            ? "Note: the public-lobby bonus risks griefers destroying your sell vehicle. A guaranteed private sale often beats a risky public one."
            : "Tip: a populated public lobby adds up to +50%, but risks your sell. Weigh it.",
        ]
          .filter((x) => x !== null)
          .join("\n"),
      );
    },
  );

  server.tool(
    "gta-payback-calculator",
    "Estimate how long a GTA Online property pays for itself: hours/runs to recoup the buy-in given a method's $/hr.",
    {
      buyIn: z.number().optional().describe("Property cost; omit to use the method's buy-in"),
      method: z.string().describe("Method id/name to earn with (e.g. cayo-perico, agency-contracts-loop)"),
    },
    async ({ buyIn, method }) => {
      const m = findMethod(method);
      if (!m) return errorText(`No method matching "${method}". See gta-best-methods.`);
      const cost = buyIn ?? m.buyIn;
      if (!cost) return text(`${m.name} has no buy-in to pay back. It nets ~${money(m.estPerHour)}/hr.`);
      const hours = cost / m.estPerHour;
      const runs = m.estMinutes ? Math.ceil(cost / Math.max(1, (m.estPerHour * m.estMinutes) / 60)) : null;
      return text(
        [
          `Paying back ${money(cost)} with ${m.name} (~${money(m.estPerHour)}/hr):`,
          `- ~${hours.toFixed(1)} hours of grinding`,
          runs ? `- ~${runs} runs (~${m.estMinutes} min each)` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  );

  server.tool(
    "gta-cayo-targets",
    "List the GTA Online Cayo Perico Heist primary targets and their payouts (normal and hard mode), plus secondary loot values.",
    {},
    async () => {
      return text(
        [
          "# Cayo Perico primary targets (normal / hard +10%)",
          "- Tequila: $630k / $693k",
          "- Ruby Necklace: $700k / $770k",
          "- Bearer Bonds: $770k / $847k",
          "- Pink Diamond: $1.3M / $1.43M",
          "- Panther Statue (event-only): $1.9M / $2.09M",
          "",
          "# Secondary loot per stack (grab gold first — best $/bag)",
          "Gold ≈ $330k > Cocaine ≈ $200k > Artwork ≈ $170k > Weed ≈ $135k > Cash ≈ $80k",
          "",
          "Elite Challenge +$200k (full loot, <15 min, no failed hacks). Setup $100k/run; Kosatka $2.2M one-time.",
        ].join("\n"),
      );
    },
  );

  server.tool(
    "gta-collectible-sets",
    "List GTA Online one-time collectible sets and their completion rewards (Signal Jammers, Playing Cards, Action Figures, etc.).",
    {},
    async () => {
      const sets = getReference().collectibles.filter((c) => c.kind === "oneTime");
      const lines = sets.map((c) => `- ${c.name} (${c.count}): ${money(c.rewardTotal ?? 0)} — ${c.notes}`);
      return text(`One-time collectible sets:\n\n${lines.join("\n")}`);
    },
  );

  server.tool(
    "gta-daily-checklist",
    "The optimal GTA Online daily money routine: every daily-reset task with its payout and the running total (~$300k+/day).",
    {},
    async () => {
      const ref = getReference();
      const daily = ref.collectibles.filter((c) => c.kind === "daily");
      const collTotal = daily.reduce((s, c) => s + (c.dailyTotal ?? 0), 0);
      const lines = daily.map((c) => `- [ ] ${c.name}: ${money(c.dailyTotal ?? 0)}`);
      const recurring = ref.recurring.map((r) => {
        const amt = r.payout ? ` (${money(r.payout)}${r.weeklyBonus ? `, +${money(r.weeklyBonus)}/week for 3` : ""})` : "";
        return `- [ ] ${r.name}${amt} — ${r.notes}`;
      });
      return text(
        [
          `# Daily money checklist (reset 06:00 UTC) — collectibles ~${money(collTotal)}/day`,
          ...lines,
          "",
          "Plus:",
          ...recurring,
          "",
          "- [ ] Empty all business safes (Nightclub, Agency, Arcade, Auto Shop, Salvage, Bail)",
          "- [ ] Activate the Mansion production boost (rotate businesses daily)",
        ].join("\n"),
      );
    },
  );
}

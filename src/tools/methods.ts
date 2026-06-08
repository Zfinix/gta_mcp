import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getReference, findMethod } from "../data/reference.js";
import { money, moneyRange, text, errorText } from "../lib/format.js";

export function registerMethodTools(server: McpServer): void {
  server.tool(
    "gta-best-methods",
    "Rank GTA Online money-making methods by estimated GTA$/hour from the bundled reference data. Filter by category, solo-friendliness, and max setup/buy-in cost.",
    {
      category: z
        .enum(["heist", "business", "active", "passive", "cargo"]).optional()
        .describe("Filter to a single category"),
      soloFriendly: z.boolean().optional().describe("Only methods playable solo"),
      maxBuyIn: z.number().optional().describe("Exclude methods whose property buy-in exceeds this"),
      limit: z.number().int().min(1).max(50).default(10),
    },
    async ({ category, soloFriendly, maxBuyIn, limit }) => {
      const ref = getReference();
      let methods = ref.methods.slice();
      if (category) methods = methods.filter((m) => m.category === category);
      if (soloFriendly) methods = methods.filter((m) => m.solo);
      if (typeof maxBuyIn === "number") methods = methods.filter((m) => m.buyIn <= maxBuyIn);
      methods.sort((a, b) => b.estPerHour - a.estPerHour);
      methods = methods.slice(0, limit);

      if (!methods.length) return text("No methods match those filters.");

      const lines = methods.map((m, i) => {
        const per = `${money(m.estPerHour)}/hr`;
        const payout = moneyRange(m.payoutMin, m.payoutMax);
        const solo = m.solo ? "solo" : "needs crew";
        const buy = m.buyIn ? `, buy-in ${money(m.buyIn)}` : "";
        const weekly = m.weeklyLimit ? `, ${m.weeklyLimit}/week` : "";
        return `${i + 1}. ${m.name} — ${per} (payout ${payout}, ${solo}${buy}${weekly})\n   ${m.notes}`;
      });
      return text(`Best methods by $/hr:\n\n${lines.join("\n\n")}`);
    },
  );

  server.tool(
    "gta-method-detail",
    "Full detail and tips for one GTA Online money-making method (e.g. 'cayo-perico', 'diamond-casino-heist', 'agency-dr-dre', 'cluckin-bell').",
    {
      method: z.string().describe("Method id or name fragment"),
    },
    async ({ method }) => {
      const m = findMethod(method);
      if (!m) {
        const ids = getReference().methods.map((x) => x.id).join(", ");
        return errorText(`No method matching "${method}". Available: ${ids}`);
      }
      const lines = [
        `# ${m.name}`,
        `Category: ${m.category} · ${m.solo ? "Solo-friendly" : "Needs a crew"}`,
        `Estimated: ${money(m.estPerHour)}/hr · Payout ${moneyRange(m.payoutMin, m.payoutMax)}`,
        m.estMinutes ? `Time per run: ~${m.estMinutes} min` : null,
        m.setupCost ? `Setup cost: ${money(m.setupCost)}/run` : null,
        m.buyIn ? `Property buy-in: ${money(m.buyIn)}` : null,
        m.cooldownMinutes ? `Cooldown: ${m.cooldownMinutes} min` : null,
        m.weeklyLimit ? `Weekly limit: ${m.weeklyLimit} runs` : null,
        m.requires.length ? `Requires: ${m.requires.join(", ")}` : null,
        m.bonusEligible ? "Eligible for weekly 2x/3x bonuses." : null,
        "",
        m.notes,
        m.tips?.length ? `\nTips:\n${m.tips.map((t) => `- ${t}`).join("\n")}` : null,
      ].filter(Boolean);
      return text(lines.join("\n"));
    },
  );
}

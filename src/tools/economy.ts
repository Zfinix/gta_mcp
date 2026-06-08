import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { allEconomics, getEconomics, weeklyInfo, BUSINESS_KEYS } from "../clients/toolkit.js";
import { money, text, errorText } from "../lib/format.js";

export function registerEconomyTools(server: McpServer): void {
  server.tool(
    "gta-business-economics",
    "Current GTA Online per-business production economics decoded from gtaweb's toolkit data: full sell value (local & high-demand), capacity, mansion production multiplier, and the high-demand bonus coefficients. Bundled snapshot, refreshable.",
    {
      business: z.string().optional().describe("One business key (acid, bunk, coke, meth, cash, weed, docs); omit for all"),
    },
    async ({ business }) => {
      const econs = business
        ? [getEconomics(business.toLowerCase().slice(0, 4))].filter(Boolean)
        : allEconomics();
      if (!econs.length) {
        return errorText(`Unknown business. Valid keys: ${Object.keys(BUSINESS_KEYS).join(", ")}`);
      }
      const lines = econs.map((e) => {
        const far = Math.round(e!.fullValueLocal * (1 + e!.maxHighDemandPct / 100));
        return (
          `- ${e!.name}: full ${money(e!.fullValueLocal)} local / up to ${money(far)} (max +${e!.maxHighDemandPct}% high-demand) · ` +
          `${e!.capacity} units · mansion boost ${e!.mansionMultiplier}× speed`
        );
      });
      const wk = weeklyInfo();
      const footer = wk
        ? `\nWeek #${wk.week}; next weekly reset ${new Date(wk.next * 1000).toUTCString()}.`
        : "";
      return text(`Current business economics (gtaweb toolkit snapshot):\n\n${lines.join("\n")}${footer}`);
    },
  );
}

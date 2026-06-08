import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getReference } from "../data/reference.js";
import { money, moneyRange, text, errorText } from "../lib/format.js";

export function registerPropertyTools(server: McpServer): void {
  server.registerTool(
    "gta-properties",
    {
      description:
        "List GTA Online income properties with cost, what they unlock, and the recommended buy priority for a money empire.",
      inputSchema: {
        maxCost: z
          .number()
          .optional()
          .describe("Only properties whose minimum cost is at or below this"),
      },
    },
    async ({ maxCost }) => {
      const ref = getReference();
      let props = ref.properties
        .slice()
        .sort((a, b) => a.buyPriority - b.buyPriority);
      if (typeof maxCost === "number")
        props = props.filter((p) => p.costMin <= maxCost);
      const lines = props.map(
        (p) =>
          `${p.buyPriority}. ${p.name} — ${moneyRange(p.costMin, p.costMax)}\n   unlocks: ${p.unlocks.join(", ")}`,
      );
      return text(
        `GTA Online properties by buy priority:\n\n${lines.join("\n")}`,
      );
    },
  );

  server.registerTool(
    "gta-property-detail",
    {
      description:
        "Detail for one GTA Online property (cost range, what it unlocks, buy priority).",
      inputSchema: {
        property: z.string().describe("Property id or name fragment"),
      },
    },
    async ({ property }) => {
      const ref = getReference();
      const q = property.toLowerCase();
      const p =
        ref.properties.find((x) => x.id === q) ||
        ref.properties.find((x) => x.name.toLowerCase().includes(q)) ||
        ref.properties.find((x) => x.id.includes(q));
      if (!p)
        return errorText(
          `No property matching "${property}". Try gta-properties to list them.`,
        );
      return text(
        [
          `# ${p.name}`,
          `Cost: ${moneyRange(p.costMin, p.costMax)}`,
          `Buy priority: #${p.buyPriority}`,
          `Unlocks: ${p.unlocks.join(", ")}`,
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "gta-mansion-info",
    {
      description:
        "Full breakdown of the GTA Online Mansion (Prix Luxury Real Estate, 'A Safehouse in the Hills', Dec 2025): the three options, the once-daily production boost mechanics, eligible businesses, and mission payouts.",
      inputSchema: {},
    },
    async () => {
      const m = getReference().mansion;
      const opts = (m.options as any[])
        .map((o) => `- ${o.name}: ${money(o.price)} (${o.location})`)
        .join("\n");
      const pb = m.productionBoost;
      return text(
        [
          `# ${m.name}`,
          `Update: ${m.update}`,
          "",
          "Options:",
          opts,
          `Fully upgraded: ~${money(m.fullyUpgraded)}`,
          "",
          `Production boost: +${pb.speedIncreasePct}% speed for ${pb.durationHours}h, ${pb.dailyLimit}×/day, rotate businesses (can't repeat).`,
          `Eligible: ${(pb.eligibleBusinesses as string[]).join(", ")}. Not eligible: ${(pb.ineligible as string[]).join(", ")}.`,
          `One-time missions: KnoWay Out finale ${money(m.missions["knoway-out-finale"])}, Michael's "Home Sweet Home" first run ${money(m.missions["home-sweet-home-first"])}.`,
          "",
          m.notes,
        ].join("\n"),
      );
    },
  );
}

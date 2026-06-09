import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getEconomics, BUSINESS_KEYS } from "../clients/toolkit.js";
import { money, text } from "../lib/format.js";

interface SellStrategy {
  key: string;
  name: string;
  tips: string[];
}

const GENERAL_TIPS: string[] = [
  "Since the Criminal Enterprises update you can run every sell mission in an invite-only/closed session — solo grinders should sell there by default and skip the grief risk entirely.",
  "The high-demand bonus adds +2.5% of the sale value per rival player in a public lobby, capping at +50% (reached around ~20 players). A full lobby on a big sell like a full Bunker is worth hundreds of thousands extra — but one griefer can destroy the cargo and wipe the whole payout, so only do it when you can defend it.",
  "If you must sell in public: register as CEO and use SecuroServ > CEO Abilities > Ghost Organization to vanish from everyone's map for the delivery window, or pop into a fresh session (Online > Find New Session) until you land in a near-empty one.",
  "Sell value scales linearly with stock, so there's no payout penalty for selling early — sell whenever the delivery will be a single, easy vehicle rather than waiting for a full bar that triggers multi-vehicle missions.",
  "Time big sells for that business's 2x/3x/4x week — check gta-weekly-bonuses first. A boosted sell doubles income for the same effort and beats grinding an unboosted method.",
  "Run the Nightclub passively in the background: it consumes nothing, pulls product from your linked businesses, and the Nightclub warehouse sells with a single Speedo van regardless of how full it is — the most grief-proof big sell in the game.",
];

const STRATEGIES: SellStrategy[] = [
  {
    key: "bunk",
    name: "Bunker (Gunrunning)",
    tips: [
      "The solo killer: a full bunker (~$1.05M-$1.5M far) spawns multiple delivery vehicles, and some far-sell missions (3+ Insurgents/Marshalls) are unwinnable solo before the timer. Sell at roughly 1.5-2 bars (under ~$210k stock) so you only get one vehicle.",
      "Buy supplies instead of stealing them — your time is worth far more than the ~$75k savings, and stolen-supply missions stall production.",
      "Sell to Los Santos (far) for the full value; the Phantom Wedge / Insurgent deliveries are the easy single-vehicle ones to hope for.",
      "Best paired with the MK II weapon research grind running at the same time.",
    ],
  },
  {
    key: "acid",
    name: "Acid Lab",
    tips: [
      "The best solo business in the game: a full lab (~$335k upgraded) always delivers as a single Brickade run, so it's safe to sell at 100% even in public.",
      "Resupply for free by running the Fooliganz/source missions, or just buy supplies — it fills fast and the sell is trivial.",
      "Upgrade the equipment ($750k) before grinding; it roughly doubles the product value per supply.",
    ],
  },
  {
    key: "coke",
    name: "Cocaine Lockup",
    tips: [
      "Highest-value MC business. A full lockup far-sells for the most of the MC drugs but can spawn multiple vehicles — solo, sell before the bar tops out to keep it to one or two deliveries.",
      "Always run the equipment + staff upgrades; unupgraded coke is barely worth supplying.",
      "Feed it into the Nightclub instead of selling directly if you want grief-proof passive income.",
    ],
  },
  {
    key: "meth",
    name: "Meth Lab",
    tips: [
      "Second-best MC drug after coke. Same solo rule: avoid letting the bar fill to a 3-vehicle delivery.",
      "Frequently gets a Double Money week — sell meth heavy when gta-weekly-bonuses shows it boosted.",
      "Equipment + staff upgrades are mandatory for it to be worth the supply cost.",
    ],
  },
  {
    key: "cash",
    name: "Counterfeit Cash",
    tips: [
      "Mid-tier MC business, cheap to run. Solo-friendly but still watch the multi-vehicle threshold on a full bar.",
      "A good Nightclub feeder; not worth dedicated grinding over Acid/Coke.",
    ],
  },
  {
    key: "weed",
    name: "Weed Farm",
    tips: [
      "Low value per hour — keep it only as a Nightclub feeder, not a primary sell.",
      "If you do sell it directly, do small single-vehicle deliveries; the full-bar far-sell isn't worth the multi-vehicle hassle solo.",
    ],
  },
  {
    key: "docs",
    name: "Document Forgery",
    tips: [
      "Lowest-value business; exists mainly to feed the Nightclub. Don't grind it standalone.",
    ],
  },
  {
    key: "nightclub",
    name: "Nightclub Warehouse",
    tips: [
      "The single most grief-proof sell: the warehouse always delivers in one Speedo van no matter how full, so sell at 100% anywhere, even a packed public lobby for the high-demand bonus.",
      "It accrues product for free from your linked businesses without consuming their stock — assign technicians to your highest-value goods (Cargo/Shipments > Sporting Goods > Cash Creation > South American Imports > Pharmaceutical > Organic Produce > Printing).",
      "Buy the equipment upgrade and an extra technician; popularity also pays ~$10k-$50k passively, so keep it topped up.",
    ],
  },
  {
    key: "hangar",
    name: "Hangar (Air Freight Cargo)",
    tips: [
      "Decent solo earner but the sell missions can be tedious and time-sensitive (anti-aircraft, fragile cargo) — its $/hr trails Acid and Cayo.",
      "Source cargo solo, sell before the warehouse fills to avoid multi-vehicle/aircraft deliveries.",
    ],
  },
  {
    key: "crates",
    name: "Special Cargo (CEO Warehouses)",
    tips: [
      "Buy in 3-crate batches to fill faster, but only fill a warehouse to a level you can sell in one delivery vehicle solo.",
      "A full large warehouse (111 crates) sells for ~$2.2M (or more with high-demand) but spawns multiple vehicles — coordinate with a crew or sell smaller batches solo.",
    ],
  },
  {
    key: "vehicle",
    name: "Import/Export (Vehicle Cargo)",
    tips: [
      "Only sell Top Range cars for the full $80k/$100k payout; export Mid/Standard range to clear them out, or keep them off the source pool.",
      "Don't damage the car during the source mission — repairs are deducted from your sale. Keep a 'Source 3 / Sell 1' rhythm to keep getting Top Range spawns.",
    ],
  },
];

function matchStrategy(q: string): SellStrategy | undefined {
  const s = q.toLowerCase();
  return (
    STRATEGIES.find((x) => x.key === s) ||
    STRATEGIES.find((x) => x.name.toLowerCase().includes(s)) ||
    STRATEGIES.find((x) => s.includes(x.key)) ||
    (s.includes("gun") ? STRATEGIES.find((x) => x.key === "bunk") : undefined) ||
    (s.includes("club") ? STRATEGIES.find((x) => x.key === "nightclub") : undefined)
  );
}

function highDemandLine(key: string): string | null {
  const econ = getEconomics(key);
  if (!econ) return null;
  const solo = econ.fullValueLocal;
  const full = Math.round(solo * (1 + econ.maxHighDemandPct / 100));
  return `Full-stock value: ~${money(solo)} solo/private → up to ~${money(full)} in a full public lobby (+${econ.maxHighDemandPct}% high-demand).`;
}

export function registerSellStrategyTool(server: McpServer): void {
  server.registerTool(
    "gta-sell-strategy",
    {
      description:
        "Sell strategies, tips, and tricks for GTA Online businesses: when to sell, how to avoid multi-vehicle solo deliveries, the high-demand public-lobby bonus and its grief tradeoff, and how to dodge griefers. Pass a business name for one, or omit for all.",
      inputSchema: {
        business: z
          .string()
          .optional()
          .describe(
            "Business name (bunker, acid, cocaine, meth, counterfeit, weed, docs, nightclub, hangar, crates, vehicle); omit for all businesses + general tips",
          ),
      },
    },
    async ({ business }) => {
      if (business) {
        const strat = matchStrategy(business);
        if (!strat)
          return text(
            `No sell strategy for "${business}". Try: ${STRATEGIES.map((s) => s.key).join(", ")}.`,
          );
        const hd = highDemandLine(strat.key);
        return text(
          [
            `# ${strat.name} — sell strategy`,
            hd ?? "",
            "",
            ...strat.tips.map((t) => `- ${t}`),
            "",
            "Use gta-sell-calculator to model the exact high-demand payout for a given player count and weekly multiplier.",
          ]
            .filter((x) => x !== "")
            .join("\n"),
        );
      }

      const sections = STRATEGIES.map((s) => {
        const hd = highDemandLine(s.key);
        return [
          `## ${s.name}`,
          hd ?? "",
          ...s.tips.map((t) => `- ${t}`),
        ]
          .filter((x) => x !== "")
          .join("\n");
      });

      return text(
        [
          "# GTA Online sell strategies — all businesses",
          "",
          "## General sell tips (apply to every business)",
          ...GENERAL_TIPS.map((t) => `- ${t}`),
          "",
          ...sections,
        ].join("\n"),
      );
    },
  );
}

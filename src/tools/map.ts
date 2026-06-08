import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getMapCategories, findMapCategory } from "../data/reference.js";
import { captureMap, mapPanelText, gtalensMapUrl } from "../lib/browseMap.js";
import { text } from "../lib/format.js";

type Content =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };
function result(content: Content[], isError = false) {
  return isError ? { content, isError: true as const } : { content };
}

export function registerMapTools(server: McpServer): void {
  server.registerTool(
    "gta-map-categories",
    {
      description:
        "List or search every GTA Online map category available on GTALens (street dealers, gun van, exotic exports, drug vehicle, collectibles, business missions, Cayo, properties, and ~100 more). Filter by group, keyword, or money-only.",
      inputSchema: {
        group: z
          .enum([
            "money-activities",
            "daily-collectibles",
            "collectibles",
            "cayo-heist",
            "business-missions",
            "vehicle-spawns",
            "properties",
            "activities",
            "public-places",
            "other",
          ])
          .optional(),
        search: z
          .string()
          .optional()
          .describe("Keyword to filter category names/slugs"),
        moneyOnly: z
          .boolean()
          .optional()
          .describe("Only money-relevant categories"),
      },
    },
    async ({ group, search, moneyOnly }) => {
      let cats = getMapCategories();
      if (group) cats = cats.filter((c) => c.group === group);
      if (moneyOnly) cats = cats.filter((c) => c.money);
      if (search) {
        const q = search.toLowerCase();
        cats = cats.filter(
          (c) => c.name.toLowerCase().includes(q) || c.slug.includes(q),
        );
      }
      if (!cats.length)
        return text(
          "No categories match. Try gta-map-categories with no filters to see all.",
        );

      const byGroup = new Map<string, string[]>();
      for (const c of cats) {
        const tag = [c.money ? "💰" : "", c.daily ? "🔄daily" : ""]
          .filter(Boolean)
          .join(" ");
        byGroup.set(c.group, [
          ...(byGroup.get(c.group) ?? []),
          `  • ${c.name} (${c.slug})${tag ? " " + tag : ""}`,
        ]);
      }
      const blocks = [...byGroup.entries()].map(
        ([g, items]) => `${g}:\n${items.join("\n")}`,
      );
      return text(
        `${cats.length} GTA map categories. Use the slug with gta-map-locations or gta-map-screenshot.\n\n${blocks.join("\n\n")}`,
      );
    },
  );

  server.registerTool(
    "gta-map-locations",
    {
      description:
        "Get the GTALens map link and (optionally) the live location/price panel for any GTA Online map category — e.g. street-dealers, exotic-exports, gun-vans, drug-vehicle, hidden-caches. Daily categories show today's spawns.",
      inputSchema: {
        category: z
          .string()
          .describe("Category slug or name (see gta-map-categories)"),
        includeLiveData: z
          .boolean()
          .default(true)
          .describe("Pull today's live panel text from the map"),
      },
    },
    async ({ category, includeLiveData }) => {
      const cat = findMapCategory(category);
      if (!cat)
        return text(
          `No map category matching "${category}". Use gta-map-categories to list them.`,
        );
      const url = gtalensMapUrl(cat.slug);
      const header = `# ${cat.name}\nGroup: ${cat.group}${cat.daily ? " · 🔄 resets daily" : ""}${cat.money ? " · 💰 money" : ""}\nMap: ${url}`;
      if (!includeLiveData) return text(header);
      try {
        const panel = await mapPanelText(cat.slug);
        return text(`${header}\n\nLive panel:\n${panel}`);
      } catch (err) {
        return text(
          `${header}\n\n(Live panel unavailable: ${(err as Error).message}. Open the map URL above.)`,
        );
      }
    },
  );

  server.registerTool(
    "gta-map-screenshot",
    {
      description:
        "Capture a screenshot of the GTA Online map for a category (street dealers, exotic exports, gun van, any collectible, Cayo, etc.) showing today's marker positions. Returns the image inline.",
      inputSchema: {
        category: z
          .string()
          .describe("Category slug or name (see gta-map-categories)"),
      },
    },
    async ({ category }) => {
      const cat = findMapCategory(category);
      if (!cat)
        return text(
          `No map category matching "${category}". Use gta-map-categories to list them.`,
        );
      try {
        const shot = await captureMap(cat.slug);
        return result([
          {
            type: "text",
            text: `GTALens map — ${cat.name} (${gtalensMapUrl(cat.slug)})`,
          },
          { type: "image", data: shot.imageBase64, mimeType: shot.mimeType },
        ]);
      } catch (err) {
        return text(
          `Could not capture the map (${(err as Error).message}). ` +
            `Open it directly: ${gtalensMapUrl(cat.slug)} (needs the \`browse\` CLI / BROWSE_FALLBACK=1).`,
        );
      }
    },
  );

  // Convenience tools for the highest-value daily/dynamic categories.
  registerQuick(
    server,
    "gta-street-dealers",
    "street-dealers",
    "Today's GTA Online street drug dealers: map + the live locations and which products sell highest there.",
  );
  registerQuick(
    server,
    "gta-exotic-exports",
    "exotic-exports",
    "Today's GTA Online Exotic Exports special-vehicle wanted list (the 10 cars to source for the Auto Shop) + map.",
  );
  registerQuick(
    server,
    "gta-gun-van",
    "gun-vans",
    "Today's GTA Online Gun Van location + map (daily discounted weapons/armor/MkII ammo).",
  );
  registerQuick(
    server,
    "gta-drug-vehicle",
    "drug-vehicle",
    "Today's GTA Online freemode Drug Vehicle location (sells for a bonus) + map.",
  );
}

function registerQuick(
  server: McpServer,
  name: string,
  slug: string,
  desc: string,
): void {
  server.registerTool(
    name,
    {
      description: desc,
      inputSchema: {},
    },
    async () => {
      const url = gtalensMapUrl(slug);
      let panel = "";
      let shot: { imageBase64: string; mimeType: string } | null = null;
      try {
        panel = await mapPanelText(slug);
      } catch (err) {
        panel = `(Live panel unavailable: ${(err as Error).message})`;
      }
      try {
        shot = await captureMap(slug);
      } catch {
        shot = null;
      }
      const content: Content[] = [
        { type: "text", text: `Map: ${url}\n\n${panel}` },
      ];
      if (shot)
        content.push({
          type: "image",
          data: shot.imageBase64,
          mimeType: shot.mimeType,
        });
      return { content };
    },
  );
}

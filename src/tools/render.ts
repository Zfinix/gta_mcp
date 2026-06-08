import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { renderMap } from "../lib/mapRender.js";
import { listCoordSets, getCoordSet } from "../data/coords.js";
import { text } from "../lib/format.js";

export function registerRenderTools(server: McpServer): void {
  server.tool(
    "gta-render-map",
    "Render a GTA Online map image OFFLINE (no browser): draws markers on the bundled base map from a known coordinate set OR from custom game-world coordinates you provide. Returns the image inline. Use game coords (x: -4000..4500, y: -5000..8400).",
    {
      category: z.string().optional().describe("Bundled coordinate set to plot (see gta-render-categories)"),
      points: z
        .array(
          z.object({
            x: z.number().describe("Game world X"),
            y: z.number().describe("Game world Y"),
            label: z.string().optional(),
          }),
        )
        .optional()
        .describe("Custom points in game-world coordinates"),
      title: z.string().optional(),
      color: z.string().optional().describe("Marker color (CSS), e.g. #ff3b30"),
    },
    async ({ category, points, title, color }) => {
      let pts = points ?? [];
      let label = title;
      if (category) {
        const set = getCoordSet(category);
        if (!set) {
          return text(
            `No bundled coordinate set "${category}". Available: ${listCoordSets().map((s) => s.category).join(", ") || "(none)"}. ` +
              "You can also pass custom points in game-world coordinates.",
          );
        }
        pts = [...pts, ...set.points];
        label = label ?? set.name;
      }
      if (!pts.length) {
        return text(
          "Nothing to render. Pass a `category` (see gta-render-categories) or `points` with game-world x/y coordinates.",
        );
      }
      const jpg = await renderMap(pts, { title: label, color });
      return {
        content: [
          { type: "text" as const, text: `Rendered ${pts.length} marker(s)${label ? ` — ${label}` : ""} (offline).` },
          { type: "image" as const, data: jpg.toString("base64"), mimeType: "image/jpeg" },
        ],
      };
    },
  );

  server.tool(
    "gta-render-categories",
    "List the bundled coordinate sets available to the offline map renderer (gta-render-map).",
    {},
    async () => {
      const sets = listCoordSets();
      if (!sets.length) return text("No bundled coordinate sets yet. Pass custom points to gta-render-map.");
      return text(
        "Offline-renderable coordinate sets:\n" +
          sets.map((s) => `- ${s.category} — ${s.name} (${s.count} points)`).join("\n"),
      );
    },
  );
}

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { renderMap } from "../lib/mapRender.js";
import { writeMapHtml } from "../lib/mapHtml.js";
import { captureMap, mapPanelText } from "../lib/browseMap.js";
import { listCoordSets, getCoordSet } from "../data/coords.js";
import { findMapCategory } from "../data/reference.js";
import { text } from "../lib/format.js";

export function registerRenderTools(server: McpServer): void {
  server.registerTool(
    "gta-live-map",
    {
      description:
        "Show TODAY's active markers for any GTA Online map category (street dealers, exotic exports, gun van, drug vehicle, daily collectibles, etc.) on the live gtalens map: returns the map image (correct marker positions) plus the live location/price data as text. Needs the browser (BROWSE_FALLBACK=1).",
      inputSchema: {
        category: z
          .string()
          .default("street-dealers")
          .describe("Map category slug or name (default: street-dealers)"),
      },
    },
    async ({ category }) => {
      const cat = findMapCategory(category);
      if (!cat) {
        return text(
          `No map category matching "${category}". Use gta-map-categories to list them.`,
        );
      }
      const url = `https://gtalens.com/map/${cat.slug}`;
      let panel = "";
      try {
        panel = await mapPanelText(cat.slug);
      } catch (err) {
        panel = `(live data unavailable: ${(err as Error).message})`;
      }
      let shot: { imageBase64: string; mimeType: string } | null = null;
      try {
        shot = await captureMap(cat.slug);
      } catch {
        shot = null;
      }
      const content: (
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      )[] = [
        {
          type: "text",
          text: `Today's ${cat.name} (live from gtalens)\nMap: ${url}\n\n${panel}`,
        },
      ];
      if (shot)
        content.push({
          type: "image",
          data: shot.imageBase64,
          mimeType: shot.mimeType,
        });
      else
        content.push({
          type: "text",
          text: `\n(Map image needs the browser; open ${url} directly.)`,
        });
      return { content };
    },
  );

  server.registerTool(
    "gta-render-map",
    {
      description:
        "Render a GTA Online map image OFFLINE (no browser): draws markers on the bundled base map from a known coordinate set OR from custom game-world coordinates you provide. Returns the image inline. Use game coords (x: -4000..4500, y: -5000..8400).",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe(
            "Bundled coordinate set to plot (see gta-render-categories)",
          ),
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
        color: z
          .string()
          .optional()
          .describe("Marker color (CSS), e.g. #ff3b30"),
      },
    },
    async ({ category, points, title, color }) => {
      let pts = points ?? [];
      let label = title;
      if (category) {
        const set = getCoordSet(category);
        if (!set) {
          return text(
            `No bundled coordinate set "${category}". Available: ${
              listCoordSets()
                .map((s) => s.category)
                .join(", ") || "(none)"
            }. ` + "You can also pass custom points in game-world coordinates.",
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
          {
            type: "text" as const,
            text: `Rendered ${pts.length} marker(s)${label ? ` — ${label}` : ""} (offline).`,
          },
          {
            type: "image" as const,
            data: jpg.toString("base64"),
            mimeType: "image/jpeg",
          },
        ],
      };
    },
  );

  server.registerTool(
    "gta-map-html",
    {
      description:
        "Generate an INTERACTIVE, zoomable GTA Online map (HTML + Leaflet, live Rockstar tiles) with your markers — stays crisp at any zoom, unlike a static image. Writes an .html file and returns its path to open in a browser. Use a bundled category and/or custom game-world points.",
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe("Bundled coordinate set (see gta-render-categories)"),
        points: z
          .array(
            z.object({
              x: z.number(),
              y: z.number(),
              label: z.string().optional(),
            }),
          )
          .optional()
          .describe("Custom points in game-world coordinates"),
        title: z.string().optional(),
      },
    },
    async ({ category, points, title }) => {
      let pts = points ?? [];
      let label = title;
      let name = "gta-map";
      if (category) {
        const set = getCoordSet(category);
        if (!set) {
          return text(
            `No bundled coordinate set "${category}". Available: ${
              listCoordSets()
                .map((s) => s.category)
                .join(", ") || "(none)"
            }.`,
          );
        }
        pts = [...pts, ...set.points];
        label = label ?? set.name;
        name = set.category;
      }
      if (!pts.length) {
        return text(
          "Nothing to map. Pass a `category` (see gta-render-categories) or `points` with game-world x/y.",
        );
      }
      const path = writeMapHtml(pts, label ?? "GTA Online Map", name);
      return text(
        `Interactive map written (${pts.length} markers).\nOpen in a browser:\n  file://${path}\n\n` +
          "Zoom/pan freely — it uses live Rockstar map tiles so it stays sharp at any zoom.",
      );
    },
  );

  server.registerTool(
    "gta-render-categories",
    {
      description:
        "List the bundled coordinate sets available to the offline map renderer (gta-render-map).",
      inputSchema: {},
    },
    async () => {
      const sets = listCoordSets();
      if (!sets.length)
        return text(
          "No bundled coordinate sets yet. Pass custom points to gta-render-map.",
        );
      return text(
        "Offline-renderable coordinate sets:\n" +
          sets
            .map((s) => `- ${s.category} — ${s.name} (${s.count} points)`)
            .join("\n"),
      );
    },
  );
}

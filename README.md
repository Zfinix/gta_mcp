# GTA Online Money Copilot — MCP server + expert skill

A two-part GTA Online money-making assistant:

1. **`gta-online-expert` skill** — durable, curated expert knowledge (money playbooks, business operations, heists, combat, optimization loops, the mansion, beginner roadmap). Auto-loads when you ask Claude anything about GTA Online. Lives in [`gta-online-expert/`](gta-online-expert/).
2. **`gta_mcp` MCP server** — 26 live/computational tools: weekly bonuses, reset timers, business operations tracking, money calculators, the full interactive map (street dealers, exotic exports, gun van, collectibles, …), and a session planner that mixes tactics so no time is wasted.

## Tools (26)

**Live / time-sensitive**
- `gta-reset-times` — countdown to daily (06:00 UTC) and weekly (Thu 07:00 UTC) resets.
- `gta-weekly-bonuses` — this week's 2x/3x event, podium, discounts (Newswire, best-effort).
- `gta-tunables-status` — per-platform tunables update timestamps (gtaweb, needs browser).
- `gta-daily-collectibles` — today's daily collectible income table + live tunables freshness.

**Money methods & reference**
- `gta-best-methods` — rank methods by $/hr (filter category/solo/buy-in).
- `gta-method-detail` — full playbook for one method.
- `gta-cayo-targets` — Cayo primary/secondary loot values.
- `gta-collectible-locations` / `gta-collectible-sets` — collectible maps + one-time set rewards.
- `gta-daily-checklist` — the optimal ~$300k/day daily routine.

**Business operations (persistent state)**
- `gta-business-set-state` — record owned businesses + resupply/sell times (persists to `data/state.json`).
- `gta-business-status` — stock %, time-to-full, sell readiness, solo-limit warnings.
- `gta-business-economics` — current per-business production economics (gtaweb toolkit snapshot).

**Properties & calculators**
- `gta-properties` / `gta-property-detail` — property catalog + buy priority.
- `gta-mansion-info` — the Mansion (Prix Luxury) deep dive.
- `gta-sell-calculator` — sell value with high-demand bonus + weekly multiplier.
- `gta-payback-calculator` — how long a property takes to pay for itself.

**The interactive map**
- `gta-map-categories` — browse/search all 110 GTALens map categories.
- `gta-map-locations` — map link + live location/price panel for any category.
- `gta-map-screenshot` — capture the live map for any category, returned inline as an image (browser).
- `gta-street-dealers` / `gta-exotic-exports` / `gta-gun-van` / `gta-drug-vehicle` — today's high-value daily spots (map + data).

**Offline map renderer (no browser)**
- `gta-render-map` — draw markers on the bundled base map from a coordinate set or custom game-world coordinates; returns the image inline. Pure Node + canvas, zero browser/network.
- `gta-render-categories` — list bundled coordinate sets.

**The planner (flagship)**
- `gta-money-plan` — given session length + goal, a ranked, time-boxed action list mixing passive income with active earners, weighted by this week's bonuses and reset urgency.

## Setup

```bash
npm install
npm run build
npm start            # stdio server
npm run smoke        # build + exercise the tools
npm run dev:inspect  # MCP Inspector UI
```

Register in Claude Desktop / Cursor (`mcpServers`):

```json
{
  "mcpServers": {
    "gta": {
      "command": "node",
      "args": ["/Users/chizi/projects/work-projects/mcp/gta_mcp/build/server.js"],
      "env": { "BROWSE_FALLBACK": "1" }
    }
  }
}
```

## Data sources & the browser dependency

- **Offline (no network/browser):** methods, businesses, properties, calculators, collectible rewards, the planner, map category catalog, and the **economy data** (bundled snapshot of gtaweb's `TOOLKIT_DATA`). These always work.
- **Browser-assisted (the `browse` CLI + local Chrome):** `gta-map-screenshot` and the live map/data tools open gtalens/gtaweb. Set `BROWSE_FALLBACK=0` to disable; those tools then degrade to returning the map URL. The map screenshots are captured live from gtalens.com.
- **Refresh bundled data** (uses `browse` once, keeps runtime offline):
  - `npm run refresh:toolkit` — re-pull the gtaweb economy snapshot (`data/toolkit-data.json`).
  - `npm run refresh:map` — regenerate the map category catalog (`data/map-categories.json`).

## Notes

- Reset math is UTC. GTA$ figures are 2025/2026 consensus and drift with patches/bonus weeks.
- The skill holds durable strategy; the MCP holds live state. They're designed to be used together.
- See [`gta-online-expert/SKILL.md`](gta-online-expert/SKILL.md) for the knowledge layer.

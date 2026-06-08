#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMethodTools } from "./tools/methods.js";
import { registerBusinessTools } from "./tools/business.js";
import { registerCollectibleTools } from "./tools/collectibles.js";
import { registerLiveDataTools } from "./tools/liveData.js";
import { registerPlannerTool } from "./tools/planner.js";
import { registerMapTools } from "./tools/map.js";
import { registerPropertyTools } from "./tools/properties.js";
import { registerCalculatorTools } from "./tools/calculators.js";
import { registerEconomyTools } from "./tools/economy.js";
import { registerRenderTools } from "./tools/render.js";

const server = new McpServer(
  { name: "gta-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

registerLiveDataTools(server);
registerCollectibleTools(server);
registerMethodTools(server);
registerBusinessTools(server);
registerPropertyTools(server);
registerCalculatorTools(server);
registerEconomyTools(server);
registerMapTools(server);
registerRenderTools(server);
registerPlannerTool(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is the MCP channel; all logs go to stderr.
  console.error("gta-mcp-server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting gta-mcp-server:", err);
  process.exit(1);
});

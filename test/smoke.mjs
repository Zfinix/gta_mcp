// Smoke test: connect to the built server over stdio and exercise the tools.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(here, "..", "build", "server.js");

const transport = new StdioClientTransport({ command: "node", args: [serverPath] });
const client = new Client({ name: "smoke", version: "1.0.0" }, { capabilities: {} });

function show(title, res) {
  const t = (res.content || []).map((c) => c.text).join("\n");
  console.log(`\n===== ${title} =====\n${t.slice(0, 900)}`);
}

await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

show("gta-reset-times", await client.callTool({ name: "gta-reset-times", arguments: {} }));
show("gta-best-methods (heist)", await client.callTool({ name: "gta-best-methods", arguments: { category: "heist" } }));
show("gta-best-methods (solo, maxBuyIn 0)", await client.callTool({ name: "gta-best-methods", arguments: { soloFriendly: true, maxBuyIn: 0 } }));
show("gta-method-detail cayo", await client.callTool({ name: "gta-method-detail", arguments: { method: "cayo" } }));
show("gta-collectible-locations gs-caches", await client.callTool({ name: "gta-collectible-locations", arguments: { type: "gs-caches" } }));

show("set-state", await client.callTool({ name: "gta-business-set-state", arguments: { businesses: [{ id: "acid-lab", resupply: true }, { id: "bunker", stockFraction: 0.5, lastResupplyAt: new Date(Date.now() - 6 * 3600_000).toISOString() }] } }));
show("business-status", await client.callTool({ name: "gta-business-status", arguments: {} }));
show("gta-money-plan", await client.callTool({ name: "gta-money-plan", arguments: { sessionMinutes: 90, solo: true, goal: "max-cash" } }));

await client.close();
console.log("\nSMOKE OK");
process.exit(0);

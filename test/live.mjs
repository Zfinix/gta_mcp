import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(here, "..", "build", "server.js");
const transport = new StdioClientTransport({ command: "node", args: [serverPath], env: { ...process.env, BROWSE_FALLBACK: "1" } });
const client = new Client({ name: "live", version: "1.0.0" }, { capabilities: {} });
function show(t, res){ console.log(`\n===== ${t} =====\n`+(res.content||[]).map(c=>c.text).join("\n").slice(0,700)); }
await client.connect(transport);
show("gta-weekly-bonuses", await client.callTool({ name: "gta-weekly-bonuses", arguments: {} }));
show("gta-tunables-status", await client.callTool({ name: "gta-tunables-status", arguments: {} }));
show("gta-daily-collectibles", await client.callTool({ name: "gta-daily-collectibles", arguments: {} }));
await client.close(); process.exit(0);

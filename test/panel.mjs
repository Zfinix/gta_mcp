import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url"; import { dirname, resolve } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const t = new StdioClientTransport({ command:"node", args:[resolve(here,"..","build","server.js")], env:{...process.env,BROWSE_FALLBACK:"1"} });
const c = new Client({name:"p",version:"1.0.0"},{capabilities:{}}); await c.connect(t);
const r = await c.callTool({name:"gta-map-locations",arguments:{category:"street-dealers",includeLiveData:true}});
console.log((r.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n").slice(0,800));
await c.close(); process.exit(0);

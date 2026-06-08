import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFileSync } from "node:fs";
const here = dirname(fileURLToPath(import.meta.url));
const sp = resolve(here, "..", "build", "server.js");
const t = new StdioClientTransport({ command: "node", args: [sp] });
const c = new Client({ name: "render", version: "1.0.0" }, { capabilities: {} });
await c.connect(t);
console.log("TOOLS:", (await c.listTools()).tools.length);
const cats = await c.callTool({name:"gta-render-categories",arguments:{}});
console.log((cats.content||[]).map(x=>x.text).filter(Boolean).join("\n"));
const r = await c.callTool({name:"gta-render-map",arguments:{category:"landmarks",title:"GTA Online — Landmarks"}});
const img = (r.content||[]).find(x=>x.type==="image");
console.log((r.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n"));
if(img){ writeFileSync("/tmp/render-out.png", Buffer.from(img.data,"base64")); console.log("saved /tmp/render-out.png", img.data.length, "b64 chars"); }
await c.close(); process.exit(0);

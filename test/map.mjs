import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFileSync } from "node:fs";
const here = dirname(fileURLToPath(import.meta.url));
const sp = resolve(here, "..", "build", "server.js");
const t = new StdioClientTransport({ command: "node", args: [sp], env: { ...process.env, BROWSE_FALLBACK: "1" } });
const c = new Client({ name: "maptest", version: "1.0.0" }, { capabilities: {} });
await c.connect(t);
async function call(name, args, save) {
  const start = Date.now();
  try {
    const r = await c.callTool({ name, arguments: args });
    const txt = (r.content||[]).filter(x=>x.type==="text").map(x=>x.text).join("\n");
    const img = (r.content||[]).find(x=>x.type==="image");
    if (img && save) writeFileSync(save, Buffer.from(img.data, "base64"));
    console.log(`\n===== ${name} ${JSON.stringify(args)} (${Date.now()-start}ms) =====`);
    console.log(txt.slice(0,500));
    if (img) console.log(`[image ${img.mimeType} -> ${save} (${img.data.length} b64)]`);
  } catch (e) { console.log(`\n===== ${name} ERROR: ${e.message}`); }
}
// offline tools
await call("gta-map-categories", { moneyOnly: true });
await call("gta-render-categories", {});
await call("gta-render-map", { category: "landmarks", title: "Test: Landmarks" }, "/tmp/m-landmarks.jpg");
await call("gta-render-map", { points: [{x:-1037,y:-2730,label:"Airport"},{x:1100,y:220,label:"Casino"},{x:-75,y:-820,label:"Maze Bank"}], title: "Test: custom points", color:"#00e5ff" }, "/tmp/m-custom.jpg");
// browser tools
await call("gta-map-locations", { category: "street-dealers", includeLiveData: true });
await call("gta-map-screenshot", { category: "street-dealers" }, "/tmp/m-dealers.png");
await call("gta-gun-van", {}, "/tmp/m-gunvan.png");
await c.close(); process.exit(0);

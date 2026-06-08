import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url"; import { dirname, resolve } from "node:path";
const here = dirname(fileURLToPath(import.meta.url));
const t = new StdioClientTransport({ command:"node", args:[resolve(here,"..","build","server.js")] });
const c = new Client({name:"h",version:"1.0.0"},{capabilities:{}}); await c.connect(t);
console.log("HAS gta-map-html:", (await c.listTools()).tools.some(x=>x.name==="gta-map-html"));
let r = await c.callTool({name:"gta-map-html",arguments:{category:"landmarks",title:"GTA Landmarks (interactive)"}});
console.log((r.content||[]).map(x=>x.text).join("\n"));
r = await c.callTool({name:"gta-map-html",arguments:{title:"Today's Street Dealers", points:[
  {x:412,y:5156,label:"Dealer (north)"},{x:499,y:-95,label:"Dealer (mid-city)"},{x:64,y:-995,label:"Dealer (downtown)"}
]}});
console.log((r.content||[]).map(x=>x.text).join("\n"));
await c.close(); process.exit(0);

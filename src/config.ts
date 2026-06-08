import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// build/config.js -> repo root is one level up from build/
const repoRoot = resolve(__dirname, "..");

export interface Config {
  browseFallback: boolean;
  browseBin: string;
  userAgent: string;
  dataDir: string;
  cacheDir: string;
  referencePath: string;
  statePath: string;
  toolkitPath: string;
}

export function loadConfig(): Config {
  const dataDir = resolve(repoRoot, "data");
  return {
    browseFallback: process.env.BROWSE_FALLBACK !== "0",
    browseBin: process.env.BROWSE_BIN || "browse",
    userAgent:
      process.env.GTA_MCP_USER_AGENT ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    dataDir,
    cacheDir: resolve(dataDir, "cache"),
    referencePath: resolve(dataDir, "reference.json"),
    statePath: resolve(dataDir, "state.json"),
    toolkitPath: resolve(dataDir, "toolkit-data.json"),
  };
}

export const config = loadConfig();

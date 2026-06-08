// Offline GTA map renderer. Draws markers on the bundled base map (data/basemap.jpg)
// using gtaweb's projection (game world X/Y -> pixel). No browser, no network.
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { resolve } from "node:path";
import { config } from "../config.js";

// Game-world coords at the corners of the bundled base map (Rockstar GTAV "game"
// tiles, zoom 4, 2048x2816). Calibrated against known landmarks. North is up;
// Los Santos sits at the south (bottom).
const TOP_LEFT = [-2866, 6780]; // [x, y] game coords at pixel (0,0)
const BOTTOM_RIGHT = [4560, -3430]; // [x, y] game coords at pixel (W,H)

export function projectGame(
  x: number,
  y: number,
  w: number,
  h: number,
): [number, number] {
  const px = ((x - TOP_LEFT[0]) / (BOTTOM_RIGHT[0] - TOP_LEFT[0])) * w;
  const py = ((y - TOP_LEFT[1]) / (BOTTOM_RIGHT[1] - TOP_LEFT[1])) * h;
  return [px, py];
}

export interface MapPoint {
  x: number;
  y: number;
  label?: string;
}

export interface RenderOptions {
  title?: string;
  color?: string;
}

let basePromise: Promise<Awaited<ReturnType<typeof loadImage>>> | undefined;
function loadBase() {
  if (!basePromise)
    basePromise = loadImage(resolve(config.dataDir, "basemap.jpg"));
  return basePromise;
}

export async function renderMap(
  points: MapPoint[],
  opts: RenderOptions = {},
): Promise<Buffer> {
  const base = await loadBase();
  const w = base.width;
  const h = base.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(base, 0, 0, w, h);

  const color = opts.color ?? "#ff3b30";
  const showLabels = points.length <= 30;

  for (const p of points) {
    const [px, py] = projectGame(p.x, p.y, w, h);
    if (px < -10 || py < -10 || px > w + 10 || py > h + 10) continue;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    if (showLabels && p.label) {
      ctx.font = "bold 13px sans-serif";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(p.label, px + 8, py + 4);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(p.label, px + 8, py + 4);
    }
  }

  if (opts.title) {
    ctx.font = "bold 22px sans-serif";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(opts.title, 16, 32);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(opts.title, 16, 32);
  }

  // count footer
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${points.length} marker(s)`, 16, h - 14);

  return canvas.toBuffer("image/jpeg", 0.9);
}

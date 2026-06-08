// Generate a self-contained interactive Leaflet map (HTML) using Rockstar's live
// GTAV tiles. Zoom is infinite and stays crisp (tiles re-render), unlike a static
// image. Markers are placed via the same game->map projection as the renderer.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "../config.js";
import type { MapPoint } from "./mapRender.js";

// Projection: game-world coords -> Leaflet CRS.Simple latLng for the Rockstar
// tile pyramid. Derived from the base-map calibration (zoom 4, 2048x2816).
const TL = [-2866, 6780];
const BR = [4560, -3430];
const W = 2048;
const H = 2816;
const Z = 4;

function esc(s: string): string {
  return s.replace(
    /[<>&]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!,
  );
}

export function buildMapHtml(
  markers: MapPoint[],
  title = "GTA Online Map",
): string {
  const permanent = markers.length <= 25;
  const data = JSON.stringify(
    markers.map((m) => ({
      x: m.x,
      y: m.y,
      label: m.label ?? "",
      color: (m as any).color,
    })),
  );
  return [
    "<!DOCTYPE html><html><head><meta charset='utf-8'>",
    "<meta name='viewport' content='width=device-width, initial-scale=1'>",
    "<title>" + esc(title) + "</title>",
    "<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'/>",
    "<script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script>",
    "<style>html,body,#map{height:100%;margin:0;background:#0c1a2a}",
    ".lbl{background:rgba(0,0,0,.6);border:none;box-shadow:none;color:#fff;font:bold 12px sans-serif}",
    ".ttl{position:absolute;top:10px;left:50px;z-index:1000;background:rgba(0,0,0,.7);color:#fff;",
    "padding:6px 12px;border-radius:6px;font:bold 15px sans-serif}</style></head>",
    "<body><div id='map'></div><div class='ttl'>" +
      esc(title) +
      "</div><script>",
    "var TL=" +
      JSON.stringify(TL) +
      ",BR=" +
      JSON.stringify(BR) +
      ",W=" +
      W +
      ",H=" +
      H +
      ",Z=" +
      Z +
      ";",
    "function g2ll(x,y){var px=(x-TL[0])/(BR[0]-TL[0])*W,py=(y-TL[1])/(BR[1]-TL[1])*H;return [-py/Math.pow(2,Z),px/Math.pow(2,Z)];}",
    "var map=L.map('map',{crs:L.CRS.Simple,minZoom:2,maxZoom:8});",
    "L.tileLayer('https://s.rsg.sc/sc/images/games/GTAV/map/game/{z}/{x}/{y}.jpg',",
    "{minZoom:2,maxZoom:8,maxNativeZoom:6,noWrap:true,tileSize:256,bounds:[[-176,0],[0,128]]}).addTo(map);",
    "map.fitBounds([[-176,0],[0,128]]);",
    "var M=" + data + ";",
    "M.forEach(function(m){var ll=g2ll(m.x,m.y);",
    "L.circleMarker(ll,{radius:6,color:'#fff',weight:2,fillColor:m.color||'#ff3b30',fillOpacity:1})",
    ".addTo(map).bindTooltip(m.label,{permanent:" +
      permanent +
      ",direction:'right',className:'lbl'});});",
    "</script></body></html>",
  ].join("\n");
}

/** Write the HTML to the project's maps/ dir and return its absolute path. */
export function writeMapHtml(
  markers: MapPoint[],
  title: string,
  name: string,
): string {
  const dir = resolve(config.dataDir, "..", "maps");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const safe = name.replace(/[^a-z0-9-]/gi, "_").toLowerCase();
  const path = resolve(dir, `${safe}.html`);
  writeFileSync(path, buildMapHtml(markers, title), "utf8");
  return path;
}

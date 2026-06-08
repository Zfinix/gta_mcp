// One-shot generator: turns the captured gtalens "/map/<slug> :: <name>" list into
// data/map-categories.json with a group, money flag, and daily/dynamic flag.
// Re-run after re-capturing the gtalens sidebar to refresh the catalog.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "data", "map-categories.json");

const RAW = `street-dealers :: Street Dealers
gun-vans :: Gun Van
recent-dlc :: A Safehouse in the Hills
golden-clovers :: Golden Clovers
lucky-clovers :: Lucky Clovers
daily-collectibles :: Daily Collectibles
smoke-on-the-water-products :: Smoke on the Water Products
ls-tags :: LS Tags
buried-stashes :: Buried Stashes
ship-wrecks :: Shipwrecks
cayo-treasure-chests :: Treasure Chests
hidden-caches :: Hidden Caches
daily-activities :: Daily Activities
madrazo-hits :: Madrazo Hits
gs-caches :: G's Caches
stash-houses :: Stash Houses
junk-energy-skydives :: Junk Energy Skydives
regular-collectibles :: Collectibles
ld-organics-products :: LD Organics Products
media-sticks :: Media Sticks
movie-props :: Movie Props
signal-jammers :: Signal Jammers
action-figures :: Action Figures
playing-cards :: Playing Cards
stunt-jumps :: Stunt Jumps
knife-flights :: Knife Flights
under-the-bridges :: Under the Bridges
armored-truck :: Armored Truck
gang-convoy :: Finders Keepers
store-robberies :: Store Robberies
metal-detectors :: Metal Detectors
exotic-exports :: Exotic Exports
drug-vehicle :: Drug Vehicle
drunk-guard :: Drunk Guard
smuggler-cache :: Smuggler Cache
smuggler-plane :: Smuggler Plane
gang-attacks :: Gang Attacks
ufo-sightseeing :: UFO Sightseeing
spray-cans :: Spray Cans
service-carbine :: Crime Scenes
navy-revolver :: Los Santos Slasher
stone-hatchet :: Bounty Targets
double-action-revolver :: Treasure Hunt
acid-lab-spawns :: Acid Lab Spawn Locations
terrorbyte-spawns :: Terrorbyte Spawn Locations
avenger-spawns :: Avenger Spawn Locations
moc-spawns :: MOC Spawn Locations
personal-aircraft-spawns :: Personal Aircraft Spawn Locations
pegasus-land-vehicles :: Pegasus Delivery Locations (Land Vehicles)
pegasus-aircrafts :: Pegasus Delivery Locations (Aircrafts)
pegasus-helicopters :: Pegasus Delivery Locations (Helicopters)
pegasus-boats :: Pegasus Delivery Locations (Boats)
kosatka-spawns :: Kosatka
imani-source-motorcycle :: Imani Source Motorcycle Spawns
cayo-perico-heist :: Cayo Perico Heist
cayo-infiltration-points :: Cayo Infiltration Points
cayo-exfiltration-points :: Cayo Exfiltration (Escape) Points
cayo-secondary-targets :: Cayo Secondary Targets
cayo-supply-trucks :: Cayo Supply Trucks
cayo-bolt-cutters :: Cayo Bolt Cutters
cayo-grappling-equipment :: Cayo Grappling Equipment
cayo-guard-clothing :: Cayo Guard Clothing
cayo-compound-entry-points :: Cayo Compound Entry Points
payphone-hits :: Payphone Hits
businesses-missions :: Businesses Missions
acid-lab-delivery-locations :: Acid Lab Delivery Locations
acid-lab-source-missions :: Acid Lab Source Missions
auto-shop-delivery-locations :: Auto Shop Service
nightclub-sell-missions :: Nightclub Goods Sell Missions
nightclub-source-missions :: Nightclub Goods Source Missions
air-freight-cargo-sell-missions :: Air Freight Cargo Sell Missions
air-freight-cargo-source-missions :: Air Freight Cargo Source Missions
bunker-sell-missions :: Bunker Stock Sell Missions
bunker-resupply-missions :: Bunker Resupply (Steal) Missions
ie-delivery :: Vehicle Cargo Sell Missions
ie-steal :: Vehicle Cargo Steal Missions
biker-businesses-sell-missions :: Biker Businesses Sell Missions
biker-businesses-resupply-missions :: Biker Businesses Resupply (Steal) Missions
special-cargo-sell-missions :: Special Cargo Sell Missions
special-cargo-source-missions :: Special Cargo Source Missions
cluckin-bell-farm-raid :: Cluckin' Bell Farm Raid (Laptop & Terrorbyte)
ceo-vip-work :: CEO/VIP Work
head-hunter :: Headhunter Targets
sight-seer :: Sightseer
time-trials :: Time Trials
time-trials-rc :: RC Bandito Time Trials
time-trials-hsw :: HSW Time Trials
diamond-casino :: The Diamond Casino & Resort
ls-car-meet :: LS Car Meet
luxury-autos :: Luxury Autos
premium-deluxe-motorsport :: Premium Deluxe Motorsport
online-properties :: Properties (all online)
bail-offices :: Bail Offices
salvage-yards :: Salvage Yards
the-freakshop :: The Freakshop (Acid Lab)
property-agencies :: Agencies
auto-shops :: Auto Shops
property-arcades :: Arcades
property-nightclubs :: Nightclubs
property-hangars :: Hangars
property-bunkers :: Bunkers
biker-businesses :: Biker Businesses
property-clubhouses :: Clubhouses
cargo-warehouses :: Special Cargo Warehouses
vehicle-warehouses :: Vehicle Warehouses
executive-offices :: Executive Offices
peyote-plants :: Peyote Plants
snow-men :: Snowmen
ammu-nations :: Ammu-Nations
mod-shops :: Mod Shops`;

const moneySlugs = new Set([
  "street-dealers", "gun-vans", "exotic-exports", "drug-vehicle", "armored-truck",
  "gang-convoy", "smuggler-cache", "smuggler-plane", "metal-detectors", "stash-houses",
  "madrazo-hits", "payphone-hits", "stone-hatchet", "golden-clovers", "lucky-clovers",
  "daily-collectibles", "smoke-on-the-water-products", "ls-tags", "buried-stashes",
  "ship-wrecks", "cayo-treasure-chests", "hidden-caches", "gs-caches", "junk-energy-skydives",
  "store-robberies", "double-action-revolver", "cluckin-bell-farm-raid", "head-hunter",
  "sight-seer", "ceo-vip-work", "ie-delivery", "ie-steal",
]);

const dailySlugs = new Set([
  "street-dealers", "gun-vans", "exotic-exports", "drug-vehicle", "daily-collectibles",
  "golden-clovers", "lucky-clovers", "ls-tags", "buried-stashes", "ship-wrecks",
  "cayo-treasure-chests", "hidden-caches", "gs-caches", "junk-energy-skydives",
  "madrazo-hits", "stash-houses", "smoke-on-the-water-products", "stone-hatchet",
  "armored-truck", "gang-convoy",
]);

function groupFor(slug, name) {
  if (slug.startsWith("cayo-")) return "cayo-heist";
  if (slug.includes("sell-missions") || slug.includes("source-missions") || slug.includes("resupply") || slug.includes("delivery-locations") || slug === "ie-delivery" || slug === "ie-steal" || slug === "businesses-missions") return "business-missions";
  if (slug.endsWith("-spawns") || slug.startsWith("pegasus-") || slug === "kosatka-spawns" || slug === "imani-source-motorcycle") return "vehicle-spawns";
  if (slug.startsWith("property-") || slug.endsWith("-offices") || slug.endsWith("-yards") || slug.endsWith("-shops") || slug.endsWith("-warehouses") || slug === "online-properties" || slug === "bail-offices" || slug === "property-agencies" || slug === "biker-businesses" || slug === "the-freakshop") return "properties";
  if (["golden-clovers","lucky-clovers","daily-collectibles","smoke-on-the-water-products","ls-tags","buried-stashes","ship-wrecks","cayo-treasure-chests","hidden-caches","gs-caches","junk-energy-skydives","peyote-plants","snow-men"].includes(slug)) return "daily-collectibles";
  if (["ld-organics-products","media-sticks","movie-props","signal-jammers","action-figures","playing-cards","spray-cans","regular-collectibles","service-carbine","navy-revolver","stone-hatchet","double-action-revolver"].includes(slug)) return "collectibles";
  if (["street-dealers","gun-vans","exotic-exports","drug-vehicle","armored-truck","gang-convoy","smuggler-cache","smuggler-plane","metal-detectors","stash-houses","madrazo-hits","payphone-hits","store-robberies","head-hunter","sight-seer","ceo-vip-work","cluckin-bell-farm-raid"].includes(slug)) return "money-activities";
  if (slug.includes("time-trials") || ["diamond-casino","ls-car-meet","luxury-autos","premium-deluxe-motorsport","stunt-jumps","knife-flights","under-the-bridges"].includes(slug)) return "activities";
  if (["ammu-nations","mod-shops","ufo-sightseeing"].includes(slug)) return "public-places";
  return "other";
}

const cats = RAW.trim().split("\n").map((line) => {
  const [slug, name] = line.split(" :: ");
  return {
    slug: slug.trim(),
    name: name.trim(),
    group: groupFor(slug.trim(), name),
    money: moneySlugs.has(slug.trim()),
    daily: dailySlugs.has(slug.trim()),
  };
});

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ source: "gtalens.com/map", categories: cats }, null, 2));
console.log(`Wrote ${cats.length} categories to ${out}`);

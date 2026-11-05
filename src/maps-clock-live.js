// Live wiring of the clock and filled maps (rules: clock.js, maps.js). Evidence and gaps: public/research/maps-clock.md.
import { ITEM_CLOCK, createClock, tickClock, clockAngle, CLOCK_FRAMES } from "./clock.js";
import { ITEM_FILLED_MAP, ITEM_EMPTY_MAP, mapStore, createEmptyMapData, updateMapData, updateVisiblePlayers, mapCloneResult, mapExtendResult } from "./maps.js";
import { toOriginal } from "./block-registry.js";
import { blockLightOpacity } from "./map-colors.js";

export function installMapsClockItems(items) {
  items[ITEM_CLOCK] = { id: ITEM_CLOCK, name: "Clock", texture: "clock", stack: 64, color: "#d6a937" };
  items[ITEM_FILLED_MAP] = { id: ITEM_FILLED_MAP, name: "Map", texture: "map_filled", stack: 64, color: "#c8b27a" };
}
// CraftingManager recipe 4 gold ingots around redstone (population-content.js passes `recipe`).
export function installMapsClockRecipes({ recipe }) { recipe("clock", "Clock", [" G ", "GRG", " G "], { G: 304, R: 360 }, ITEM_CLOCK); }
// RecipesMapCloning and RecipesMapExtending (survival.craftingResult hook).
export function mapsCraftingResult(cells, size) {
  const r = mapCloneResult(cells) ?? mapExtendResult(cells, size, mapStore);
  return r ? { ...r } : null;
}

// ---- the clock sprite (TextureClock): the live frame cut from clock.png ----
export const clockState = createClock();
const frameUrls = new Map(), urlSet = new Set();
let strip = null;
function loadStrip() {
  if (strip || typeof Image === "undefined") return;
  strip = new Image();
  strip.src = "/media/1.7.10/items/clock.png";
}
export function clockFrameUrl(frame = clockState.frame) {
  loadStrip();
  if (!strip?.complete || !strip.naturalWidth || typeof document === "undefined") return "/media/1.7.10/items/clock.png";
  if (!frameUrls.has(frame)) {
    const c = document.createElement("canvas"); c.width = c.height = 16;
    c.getContext("2d").drawImage(strip, 0, frame * 16, 16, 16, 0, 0, 16, 16);
    const url = c.toDataURL("image/png"); frameUrls.set(frame, url); urlSet.add(url);
  }
  return frameUrls.get(frame);
}
export const clockFrame = () => clockState.frame;

// Per-original-block opacity cache by internal id for the height scan.
const opacityCache = new Map();
const opacity = (id) => { let o = opacityCache.get(id); if (o === undefined) { const t = toOriginal(id, 0); o = t ? blockLightOpacity(t[0]) : 0; opacityCache.set(id, o); } return o; };
const worldContext = (world, dimension = 0) => ({
  dimension, noSky: false,
  blockAt: (x, y, z) => { const id = world.get(x, y, z); if (!id) return 0; const t = toOriginal(id, world.getMeta(x, y, z)); return t ? (t[0] << 4) | (t[1] & 15) : 0; },
  chunkEmpty: (x, z) => !world.isLoaded(x, z),
  heightValue: (x, z) => { for (let y = Math.min(255, (world.height ?? 256) - 1); y >= 0; y--) if (opacity(world.get(x, y, z)) > 0) return y + 1; return 0; },
});

export class MapsClock {
  constructor() { this.dirtyRevision = -1; this.cache = new Map(); }
  // ItemEmptyMap.onItemRightClick: returns the filled map stack or null.
  useEmptyMap(state) {
    const s = state.survival, p = state.position;
    mapStore.spawn = state.spawn ?? mapStore.spawn;
    const data = createEmptyMapData(mapStore, { x: p.x, z: p.z, dimension: 0 });
    if (!s.creative) s.take(ITEM_EMPTY_MAP);
    const left = s.add(ITEM_FILLED_MAP, 1, data.id);
    return { data, stored: left };
  }
  // ItemMap.onUpdate for every filled map in the inventory, updateMapData for the selected slot (20 Hz).
  tick({ survival, position, yaw, world, time, name = "Player" }) {
    const surface = (world?.dimension ?? 0) === 0; // TextureClock: !worldProvider.isSurfaceWorld spins (dimensions track)
    tickClock(clockState, clockAngle(time, surface));
    if (typeof document !== "undefined") {
      const url = clockFrameUrl();
      if (this.lastFrame !== clockState.frame) {
        this.lastFrame = clockState.frame;
        for (const img of document.querySelectorAll("img.vanilla-item-icon")) if (urlSet.has(img.getAttribute("src")) && img.getAttribute("src") !== url) img.setAttribute("src", url);
      }
      // Freshly drawn slots point at the raw 16x1024 strip; swap in the current frame once it has loaded.
      if (urlSet.has(url)) for (const img of document.querySelectorAll('img[src="/media/1.7.10/items/clock.png"]')) img.setAttribute("src", url);
    }
    mapStore.spawn = mapStore.spawn ?? { x: 0, z: 0 };
    const player = { name, x: position.x, z: position.z, yaw, dimension: 0 };
    const held = survival.held;
    for (const stack of survival.inventory.main) {
      if (stack?.id !== ITEM_FILLED_MAP) continue;
      const data = mapStore.ensure(stack);
      updateVisiblePlayers(data, player, true, time);
      if (stack === held) updateMapData(data, worldContext(world, 0), player);
    }
  }
  serialize() { return mapStore.toJSON(); }
  load(json) { mapStore.load(json); }
}

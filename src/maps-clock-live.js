// Live wiring of the clock and filled maps (rules: clock.js, maps.js). Evidence and gaps: public/research/maps-clock.md.
import { ITEM_CLOCK, createClock, tickClock, clockAngle, CLOCK_FRAMES } from "./clock.js";
import { ITEM_FILLED_MAP, ITEM_EMPTY_MAP, mapStore, createEmptyMapData, updateMapData, updateVisiblePlayers, mapCloneResult, mapExtendResult } from "./maps.js";
import { toOriginal } from "./block-registry.js";
import { blockLightOpacity } from "./map-colors.js";
import { onResourcesRefreshed } from "./resource-refresh.js";
import { versioned } from "./media-version.js";
import { tickItemAnimations, registerFrameTag } from "./item-animation.js";
import { clockFrameCount, spriteEpoch } from "./sprite-frames.js";

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
let epochSeen = 0;
const frameUrls = new Map(), urlSet = new Set();
let strip = null;
function loadStrip() {
  if (strip || typeof Image === "undefined") return;
  strip = new Image();
  strip.src = versioned("/media/1.7.10/items/clock.png");
}
// Resource pack refresh: forget the cut frames and re-read the strip.
onResourcesRefreshed(() => { strip = null; frameUrls.clear(); });
export function clockFrameUrl(frame = clockState.frame) {
  loadStrip();
  if (!strip?.complete || !strip.naturalWidth || typeof document === "undefined") {
    // The raw strip stands in until it loads. It gets its own frame tag (-1) so a framed or dropped clock built meanwhile
    // is rebuilt when frame 0 arrives (tag 0 would equal the raw url's default tag and the first frame never replaced it).
    const raw = "/media/1.7.10/items/clock.png";
    registerFrameTag(raw, -1); registerFrameTag(versioned(raw), -1);
    return raw;
  }
  if (!frameUrls.has(frame)) {
    const c = document.createElement("canvas"); const f = strip.naturalWidth; c.width = c.height = f; // TextureClock cells are square, as wide as the strip
    c.getContext("2d").drawImage(strip, 0, frame * f, f, f, 0, 0, f, f);
    const url = c.toDataURL("image/png"); frameUrls.set(frame, url); urlSet.add(url); registerFrameTag(url, frame);
  }
  return frameUrls.get(frame);
}
export const clockFrame = () => clockState.frame;

// Per-original-block opacity cache by internal id for the height scan.
const opacityCache = new Map();
const opacity = (id) => { let o = opacityCache.get(id); if (o === undefined) { const t = toOriginal(id, 0); o = t ? blockLightOpacity(t[0]) : 0; opacityCache.set(id, o); } return o; };
// ItemMap.updateMapData reads world.provider.dimensionId and provider.hasNoSky (aqo.g: Nether and End, half radius, fixed dirt/stone dither).
const worldContext = (world, dimension = world?.dimension ?? 0) => ({
  dimension, noSky: !!world?.hasNoSky,
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
    const data = createEmptyMapData(mapStore, { x: p.x, z: p.z, dimension: state.world?.dimension ?? 0 });
    if (!s.creative) s.take(ITEM_EMPTY_MAP);
    const left = s.add(ITEM_FILLED_MAP, 1, data.id);
    return { data, stored: left };
  }
  // ItemMap.onUpdate for every filled map in the inventory, updateMapData for the selected slot (20 Hz).
  tick({ survival, position, yaw, world, time, name = "Player", frames = null }) {
    const surface = (world?.dimension ?? 0) === 0; // TextureClock: !worldProvider.isSurfaceWorld spins (dimensions track)
    if (epochSeen !== spriteEpoch()) { epochSeen = spriteEpoch(); Object.assign(clockState, createClock()); } // new sprite after a pack with another strip
    tickClock(clockState, clockAngle(time, surface), clockFrameCount());
    tickItemAnimations(); // pack-animated item sprites (item-animation.js)
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
    const player = { name, x: position.x, z: position.z, yaw, dimension: world?.dimension ?? 0 };
    const held = survival.held;
    for (const stack of survival.inventory.main) {
      if (stack?.id !== ITEM_FILLED_MAP) continue;
      const data = mapStore.ensure(stack);
      updateVisiblePlayers(data, player, true, time);
      if (stack === held) updateMapData(data, worldContext(world), player);
    }
    // EntityTrackerEntry: every 10 ticks a frame holding a map runs MapData.updateVisiblePlayers for the players tracking it; the
    // stack is on an item frame, so the inventory test fails (the player's marker is dropped) and the "frame-<id>" marker is added.
    if (frames && time % 10 === 0) {
      for (const e of frames) {
        if (e.kind !== "frame" || e.dead || e.item?.id !== ITEM_FILLED_MAP) continue;
        const data = mapStore.get(e.item.damage | 0);
        if (!data) continue;
        updateVisiblePlayers(data, player, false, time);
        updateVisiblePlayers(data, player, true, time, { id: e.id, x: e.tx, z: e.tz, direction: e.dir });
      }
    }
  }
  serialize() { return mapStore.toJSON(); }
  load(json) { mapStore.load(json); }
}

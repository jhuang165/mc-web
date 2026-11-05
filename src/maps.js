// Maps (ItemMap adh, ItemEmptyMap acl, MapData ayi/ayj/ayk, MapStorage azq, RecipesMapCloning afb, RecipesMapExtending afc),
// Minecraft Java 1.7.10. Pure rules; the live wiring is maps-clock-live.js. Evidence: public/research/maps-clock-reference.json
// (tools/probes/MapsClockProbe.java) and public/research/maps-clock.md.
import { blockMapColor, blockIsLiquid, blockLightOpacity, COLOR_AIR, COLOR_WATER, COLOR_DIRT, COLOR_STONE } from "./map-colors.js";

import { ITEM_CLOCK } from "./clock.js";
const f = Math.fround;
export const ITEM_FILLED_MAP = 2081; // original item 358
export const ITEM_EMPTY_MAP = 379; // original item 395 (existing inert item, now usable)
export const MAPS_CLOCK_ITEMS = Object.freeze({ 347: ITEM_CLOCK, 358: ITEM_FILLED_MAP }); // clock 347 -> 2080, filled map 358 -> 2081
export const ITEM_PAPER = 328; // original item 339
export const MAP_SIZE = 128, MAP_BYTES = MAP_SIZE * MAP_SIZE, MAX_SCALE = 4;
export const DECORATION_PLAYER = 0, DECORATION_FRAME = 1, DECORATION_OFFMAP = 6;
export const WILDCARD = 32767;

// ---- MapData (ayi) ----
export function createMapData(id, { scale = 0, xCenter = 0, zCenter = 0, dimension = 0 } = {}) {
  return { id, scale, xCenter, zCenter, dimension, colors: new Int8Array(MAP_BYTES), decorations: new Map(), infos: new Map(), dirty: false, revision: 0 };
}
// ayi.func_76185_a: a column range changed (the live map texture repaints these).
const setColumnDirty = (data, x, lo, hi) => {
  const column = data.dirtyColumns ?? (data.dirtyColumns = new Map()), old = column.get(x);
  column.set(x, old ? [Math.min(old[0], lo), Math.max(old[1], hi)] : [lo, hi]);
  data.revision++; data.dirty = true;
};
// ayi.a(yz): the per-player MapInfo (ayj): update counter d and dirty column range b/c.
export function mapInfo(data, name) {
  let info = data.infos.get(name);
  if (!info) { info = { d: 0, lo: new Int32Array(MAP_SIZE), hi: new Int32Array(MAP_SIZE).fill(MAP_SIZE - 1) }; data.infos.set(name, info); }
  return info;
}

// ItemMap.updateMapData (adh.a(ahb, sa, ayi)). `ctx`: { dimension, noSky, blockAt(x, y, z) -> (originalId << 4 | meta),
// chunkEmpty(x, z) -> boolean, onTie?(x, z) }. `player`: { name, x, z }. Returns the number of changed bytes.
// HashMultiset.copyHighestCountFirst orders ties by identity hash in the original (nondeterministic): the first
// inserted of the tied colours wins here and `onTie` reports the cell, so the evidence test can mask it.
export function updateMapData(data, ctx, player) {
  if (ctx.dimension !== data.dimension) return 0;
  const scale = 1 << data.scale, px = Math.trunc((Math.floor(player.x - data.xCenter)) / scale) + 64, pz = Math.trunc((Math.floor(player.z - data.zCenter)) / scale) + 64;
  let radius = Math.trunc(MAP_SIZE / scale);
  if (ctx.noSky) radius = Math.trunc(radius / 2);
  const info = mapInfo(data, player.name);
  info.d++;
  const heightValue = ctx.heightValue ?? ((wx, wz) => {
    for (let y = 255; y >= 0; y--) if (blockLightOpacity(ctx.blockAt(wx, y, wz) >> 4) > 0) return y + 1;
    return 0;
  });
  let changed = 0;
  for (let x = px - radius + 1; x < px + radius; x++) {
    if ((x & 15) !== (info.d & 15)) continue;
    let minY = 255, maxY = 0, previous = 0;
    for (let z = pz - radius - 1; z < pz + radius; z++) {
      if (!(x >= 0 && z >= -1 && x < MAP_SIZE && z < MAP_SIZE)) continue;
      const dx = x - px, dz = z - pz, outer = dx * dx + dz * dz > (radius - 2) * (radius - 2);
      const wx = (Math.trunc(data.xCenter / scale) + x - 64) * scale, wz = (Math.trunc(data.zCenter / scale) + z - 64) * scale;
      if (ctx.chunkEmpty(wx, wz)) continue;
      let liquidDepth = 0, heightSum = 0;
      const counts = new Map();
      const add = (color, n = 1) => counts.set(color, (counts.get(color) ?? 0) + n);
      if (ctx.noSky) {
        let h = (wx + Math.imul(wz, 231871)) | 0;
        h = (Math.imul(Math.imul(h, h), 31287121) + Math.imul(h, 11)) | 0;
        if (((h >> 20) & 1) === 0) add(COLOR_DIRT, 10); else add(COLOR_STONE, 100);
        heightSum = 100;
      } else {
        for (let i = 0; i < scale; i++) for (let j = 0; j < scale; j++) {
          let h = heightValue(wx + i, wz + j) + 1, code = 0;
          if (h > 1) {
            do { --h; code = ctx.blockAt(wx + i, h, wz + j); } while (blockMapColor(code >> 4, code & 15) === COLOR_AIR && h > 0);
            if (h > 0 && blockIsLiquid(code >> 4)) {
              let k = h - 1, below;
              do { below = ctx.blockAt(wx + i, k--, wz + j) >> 4; ++liquidDepth; } while (k > 0 && blockIsLiquid(below));
            }
          }
          heightSum += h / (scale * scale);
          add(blockMapColor(code >> 4, code & 15));
        }
      }
      liquidDepth = Math.trunc(liquidDepth / (scale * scale));
      let shade = (heightSum - previous) * 4 / (scale + 4) + (((x + z) & 1) - 0.5) * 0.4, b = 1;
      if (shade > 0.6) b = 2;
      if (shade < -0.6) b = 0;
      let color = COLOR_AIR, best = 0, tied = false;
      for (const [c, n] of counts) { if (n > best) { best = n; color = c; tied = false; } else if (n === best) tied = true; }
      if (tied) ctx.onTie?.(x, z);
      if (color === COLOR_WATER) {
        shade = liquidDepth * 0.1 + ((x + z) & 1) * 0.2; b = 1;
        if (shade < 0.5) b = 2;
        if (shade > 0.9) b = 0;
      }
      previous = heightSum;
      if (z < 0) continue;
      if (dx * dx + dz * dz >= radius * radius) continue;
      if (outer && ((x + z) & 1) === 0) continue;
      const value = ((color * 4 + b) << 24) >> 24, at = x + z * MAP_SIZE;
      if (data.colors[at] !== value) {
        if (minY > z) minY = z;
        if (maxY < z) maxY = z;
        data.colors[at] = value; changed++;
      }
    }
    if (minY <= maxY) setColumnDirty(data, x, minY, maxY);
  }
  return changed;
}

// ---- decorations (MapData.updateVisiblePlayers ayi.a(yz, add) and the private add ayi.a(int, ahb, String, x, z, yaw)) ----
// Entries are [type, x, y, rotation] bytes keyed by the player's name (or "frame-<id>").
const byte = (v) => (v << 24) >> 24;
export function addDecoration(data, type, worldTime, key, x, z, yaw) {
  const scale = 1 << data.scale;
  const fx = f(f(x - data.xCenter) / scale), fz = f(f(z - data.zCenter) / scale);
  let px = byte(Math.trunc(f(fx * 2) + 0.5)), pz = byte(Math.trunc(f(fz * 2) + 0.5)), rotation;
  if (fx >= -63 && fz >= -63 && fx <= 63 && fz <= 63) {
    const turned = yaw + (yaw < 0 ? -8 : 8);
    rotation = byte(Math.trunc(turned * 16 / 360));
    if (data.dimension < 0) {
      const i = Math.trunc(worldTime / 10) | 0;
      rotation = byte(((Math.imul(Math.imul(i, i), 34187121) + Math.imul(i, 121)) | 0) >> 15 & 15);
    }
  } else if (Math.abs(fx) < 320 && Math.abs(fz) < 320) {
    type = DECORATION_OFFMAP; rotation = 0;
    if (fx <= -63) px = byte(Math.trunc(63 * 2 + 2.5));
    if (fz <= -63) pz = byte(Math.trunc(63 * 2 + 2.5));
    if (fx >= 63) px = byte(63 * 2 + 1);
    if (fz >= 63) pz = byte(63 * 2 + 1);
  } else { data.decorations.delete(key); return; }
  data.decorations.set(key, [type, px, pz, rotation]);
}
// ayi.a(yz, add): `holdsMap` is InventoryPlayer.hasItemStack(stack); `player.dimension` is Entity.dimension; `frame`
// is { id, x, z, direction } for a stack in an item frame (decoration "frame-<id>").
export function updateVisiblePlayers(data, player, holdsMap, worldTime, frame = null) {
  mapInfo(data, player.name);
  if (!holdsMap) { data.decorations.delete(player.name); return; }
  if (!frame && player.dimension === data.dimension) addDecoration(data, DECORATION_PLAYER, worldTime, player.name, player.x, player.z, player.yaw);
  if (frame) addDecoration(data, DECORATION_FRAME, worldTime, `frame-${frame.id}`, frame.x, frame.z, frame.direction * 90);
}

// ---- MapStorage and the id counter (World.getUniqueDataId "map", data/idcounts.dat) ----
export class MapStore {
  constructor() { this.maps = new Map(); this.counter = 0; this.spawn = { x: 0, z: 0 }; this.dimension = 0; this.revision = 0; }
  nextId() { return this.counter++; }
  get(id) { return this.maps.get(id); }
  set(data) { this.maps.set(data.id, data); this.revision++; }
  // ItemMap.getMapData (adh.a(add, ahb)): a missing map is created at scale 3 around the spawn (ayi.c in 1.7.10 reads
  // spawnX as a float division and spawnZ as an int division first; the quirk is kept: probe record autoCreate).
  ensure(stack) {
    let data = this.maps.get(stack.damage | 0);
    if (data) return data;
    stack.damage = this.nextId();
    const size = MAP_SIZE * (1 << 3);
    data = createMapData(stack.damage, { scale: 3, dimension: this.dimension,
      xCenter: Math.floor(f(f(f(this.spawn.x) / f(size)) + 0.5)) * size | 0, zCenter: Math.floor(f(f(Math.trunc(this.spawn.z / size)) + 0.5)) * size | 0 });
    this.set(data);
    return data;
  }
  toJSON() { return { counter: this.counter, maps: [...this.maps.values()].map(mapToJSON) }; }
  load(json) {
    this.maps = new Map(); this.counter = json?.counter | 0;
    for (const m of json?.maps ?? []) { const d = mapFromJSON(m); if (d) this.maps.set(d.id, d); }
    this.revision++;
  }
}
export function mapToJSON(d) {
  return { id: d.id, scale: d.scale, xCenter: d.xCenter, zCenter: d.zCenter, dimension: d.dimension, colors: runLength(d.colors) };
}
export function mapFromJSON(m) {
  if (!m || !Number.isInteger(m.id)) return null;
  const d = createMapData(m.id, { scale: Math.max(0, Math.min(MAX_SCALE, m.scale | 0)), xCenter: m.xCenter | 0, zCenter: m.zCenter | 0, dimension: m.dimension | 0 });
  unrun(m.colors, d.colors);
  return d;
}
// [value, count, ...] pairs keep the browser save small (a 16 KiB map is mostly runs).
function runLength(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length;) { let j = i; while (j < bytes.length && bytes[j] === bytes[i]) j++; out.push(bytes[i], j - i); i = j; }
  return out;
}
function unrun(runs, bytes) {
  if (!Array.isArray(runs)) return;
  let at = 0;
  for (let i = 0; i + 1 < runs.length && at < bytes.length; i += 2) { const n = Math.min(runs[i + 1] | 0, bytes.length - at); bytes.fill(runs[i] | 0, at, at + n); at += n; }
}

// ItemEmptyMap.onItemRightClick (acl.a): a new map at scale 0 centred by Math.round(position / 128) * 128.
export function createEmptyMapData(store, player) {
  const size = MAP_SIZE, id = store.nextId();
  const data = createMapData(id, { scale: 0, dimension: player.dimension ?? 0,
    xCenter: Math.floor(player.x / size + 0.5) * size | 0, zCenter: Math.floor(player.z / size + 0.5) * size | 0 });
  store.set(data);
  return data;
}
// ItemMap.onCreated (adh.d): a stack carrying map_is_scaling takes a new id and the next scale. Mutates `stack`.
export function mapOnCreated(store, stack) {
  if (!stack?.mapScaling) return stack;
  const old = store.ensure(stack);
  stack.damage = store.nextId();
  delete stack.mapScaling;
  store.set(createMapData(stack.damage, { scale: Math.min(old.scale + 1, MAX_SCALE), xCenter: old.xCenter, zCenter: old.zCenter, dimension: old.dimension }));
  return stack;
}

// ---- crafting ----
const isMap = (s) => s?.id === ITEM_FILLED_MAP, isEmpty = (s) => s?.id === ITEM_EMPTY_MAP;
// RecipesMapCloning.matches/getCraftingResult: one filled map plus at least one empty map, nothing else.
export function mapCloneResult(cells) {
  let map = null, empty = 0;
  for (const s of cells) {
    if (!s) continue;
    if (isMap(s)) { if (map) return null; map = s; } else if (isEmpty(s)) empty++; else return null;
  }
  return map && empty > 0 ? { ...map, count: empty + 1 } : null;
}
// RecipesMapExtending (shaped 3x3, eight paper around any filled map whose data is below scale 4): the result is a
// copy with map_is_scaling; the new id is taken when the result is picked up (mapOnCreated).
export function mapExtendResult(cells, size, store) {
  if (size !== 3 || cells.length < 9) return null;
  for (let i = 0; i < 9; i++) {
    const s = cells[i];
    if (i === 4 ? !isMap(s) : s?.id !== ITEM_PAPER) return null;
  }
  const data = store.get(cells[4].damage | 0);
  if (data && data.scale >= MAX_SCALE) return null; // a missing map is created at scale 3 when the result is taken
  return { ...cells[4], count: 1, mapScaling: true };
}

// The live map storage (World.mapStorage): one per page; maps-clock-live.js saves and loads it.
export const mapStore = new MapStore();
export const onMapCrafted = (stack) => mapOnCreated(mapStore, stack); // SlotCrafting.onCrafting -> Item.onCreated

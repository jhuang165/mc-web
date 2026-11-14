// Layout of the terrain atlas the chunk mesher samples (block-textures.js), batch 65. Pure (no DOM, no three) so the mesh workers and tests use it too.
//
// With no resource pack (every sprite at its vanilla 16 px) the layout is the executed 1.7.10 one (atlas-layout.js, 512x256, 349 sprites); the port-only tiles (the three chest
// faces) take free 16 px cells in the area the native atlas leaves empty. When a pack gives sprites another size, the blocks TextureMap is stitched again by the ported Stitcher
// (stitcher.js: largest first, slot tree, power-of-two growth, holder rounding to 2^mip) over every native sprite at its pack size (sprites the port never loads keep their vanilla
// size, as the item sheets do), the port-only tiles at their own size, and the mipmap level limit comes from the smallest sprite (TextureMap.loadTextureAtlas).
import { NATIVE_BLOCK_SPRITES, NATIVE_ATLAS_WIDTH, NATIVE_ATLAS_HEIGHT } from "./atlas-layout.js";
import { stitch, mipLevelsFor } from "./stitcher.js";

export const VANILLA_TILE = 16;
// GL_MAX_TEXTURE_SIZE as assumed by the executed Stitcher probe; the page passes the real limit of its context.
export const DEFAULT_MAX_TEXTURE_SIZE = 16384;

const nativeSize = (name) => NATIVE_BLOCK_SPRITES[name]?.[2] ?? VANILLA_TILE;

// The vanilla layout: native positions, port-only tiles in the first free 16 px cell row by row (below the native atlas if that ever runs out).
export function vanillaTerrainLayout(tiles) {
  const busy = new Set(), mark = (x, y, w) => { for (let j = 0; j < w; j += 16) for (let i = 0; i < w; i += 16) busy.add((x + i) + "," + (y + j)); };
  for (const [x, y, w] of Object.values(NATIVE_BLOCK_SPRITES)) mark(x, y, w);
  let cx = 0, cy = 0;
  const origins = tiles.map((name) => {
    const n = NATIVE_BLOCK_SPRITES[name];
    if (n) return [n[0], n[1]];
    while (busy.has(cx + "," + cy)) { cx += 16; if (cx >= NATIVE_ATLAS_WIDTH) { cx = 0; cy += 16; } }
    const o = [cx, cy]; busy.add(cx + "," + cy); return o;
  });
  const rows = Math.max(NATIVE_ATLAS_HEIGHT / 16, ...origins.map((o) => o[1] / 16 + 1));
  return { width: NATIVE_ATLAS_WIDTH, height: rows * 16, origins, sizes: tiles.map(() => VANILLA_TILE), hd: false, mipCap: 4 };
}

// `known`: Map (or plain object) tile name -> square sprite size in pixels of the tiles whose image was seen; every other tile keeps its vanilla size.
// opts: maxSize (GL_MAX_TEXTURE_SIZE), mip (the mipmap level setting the Stitcher is built with, capped by the smallest sprite).
// Returns { width, height, origins: [[x, y]] per tile, sizes: [px] per tile, hd, mipCap }. A pack too large for the context (the native "Unable to fit" crash)
// falls back to the same pack at half, a quarter, ... of its sprite sizes (never below 16 px), and finally to the vanilla layout; `scaledDown` says so.
export function terrainLayout(tiles, known = new Map(), opts = {}) {
  const map = known instanceof Map ? known : new Map(Object.entries(known));
  const same = tiles.every((n) => (map.get(n) ?? nativeSize(n)) === nativeSize(n));
  if (same) return vanillaTerrainLayout(tiles);
  const maxSize = opts.maxSize ?? DEFAULT_MAX_TEXTURE_SIZE, mipSetting = opts.mip ?? 0;
  for (let div = 1; div <= 64; div *= 2) {
    const size = (name) => { const s = map.get(name); return s === undefined ? nativeSize(name) : div === 1 ? s : Math.max(VANILLA_TILE, Math.round(s / div)); };
    const want = new Map();
    for (const name of Object.keys(NATIVE_BLOCK_SPRITES)) want.set(name, size(name));
    for (const name of tiles) if (!want.has(name)) want.set(name, size(name));
    // (the executed Stitcher is built with the setting itself; only the levels uploaded are capped by the smallest sprite)
    const sizes = [...want.values()], mip = mipSetting, mipCap = mipLevelsFor(sizes, 4);
    // 1. The native sprites alone: exactly what the executed Stitcher would lay out. 2. The port-only tiles go into free cells of that atlas (so the native positions never
    // move because of them); only when no free cell fits (or the native set does not fit) are they stitched in with everything else.
    const natives = Object.keys(NATIVE_BLOCK_SPRITES).map((name) => ({ name, width: want.get(name), height: want.get(name) })), extras = tiles.filter((n) => !NATIVE_BLOCK_SPRITES[n]);
    let out = null, placed = null;
    try { out = stitch(natives, { maxSize, mip }); } catch { /* falls through to the combined attempt */ }
    if (out) placed = placeExtras(out, extras, (n) => want.get(n), Math.min(VANILLA_TILE, ...sizes));
    if (!placed) {
      try { out = stitch([...want].map(([name, s]) => ({ name, width: s, height: s })), { maxSize, mip }); } catch { continue; }
      placed = out.sprites.map((s) => [s.name, s.x, s.y, s.w]);
    }
    const at = new Map(placed.map(([n, x, y, w]) => [n, [x, y, w]]));
    return { width: out.width, height: out.height, hd: true, mipCap, scaledDown: div > 1, origins: tiles.map((n) => [at.get(n)[0], at.get(n)[1]]), sizes: tiles.map((n) => at.get(n)[2]) };
  }
  return { ...vanillaTerrainLayout(tiles), scaledDown: true };
}

// Native sprites of a stitched map plus the port-only tiles in free cells (row by row, aligned to `unit`); null when one does not fit. Returns [[name, x, y, size]].
function placeExtras(out, extras, sizeOf, unit) {
  const cols = Math.ceil(out.width / unit), rows = Math.ceil(out.height / unit), busy = new Uint8Array(cols * rows);
  const mark = (x, y, w, h) => { for (let j = Math.floor(y / unit); j < Math.ceil((y + h) / unit); j++) for (let i = Math.floor(x / unit); i < Math.ceil((x + w) / unit); i++) busy[j * cols + i] = 1; };
  const placed = out.sprites.map((s) => { mark(s.x, s.y, s.w, s.h); return [s.name, s.x, s.y, s.w]; });
  for (const name of extras) {
    const S = sizeOf(name), n = Math.ceil(S / unit);
    let hit = null;
    for (let j = 0; j + n <= rows && !hit; j++) for (let i = 0; i + n <= cols && !hit; i++) {
      let free = true;
      for (let b = 0; b < n && free; b++) for (let a = 0; a < n; a++) if (busy[(j + b) * cols + i + a]) { free = false; break; }
      if (free) hit = [i * unit, j * unit];
    }
    if (!hit) return null;
    mark(hit[0], hit[1], S, S); placed.push([name, hit[0], hit[1], S]);
  }
  return placed;
}

// The compact form of `known` that crosses to the mesh workers: only the sizes that differ from vanilla, as a plain object.
export function nonVanillaSizes(known) {
  const out = {};
  for (const [name, s] of known) if (s !== nativeSize(name)) out[name] = s;
  return out;
}

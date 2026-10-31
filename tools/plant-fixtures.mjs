// The map-backed world double of tools/probes/PlantProbe.java for src/plants.test.js and
// src/falling.test.js: cells come from a fixture in original block ids, converted to this build's.
import { SAND, GRAVEL, CACTUS, REEDS, WATER, LAVA, FIRE, SAPLING, WEB, LADDER, SNOW_LAYER, ICE, YELLOW_FLOWER, solidBlock } from "../src/world.js";

// Original block ids (and metadata) to this build's, and back for the blocks the code writes.
export const MC_BLOCK = { 0: 0, 1: 3, 2: 1, 3: 2, 6: SAPLING, 8: WATER, 9: WATER, 10: LAVA, 11: LAVA, 12: SAND, 13: GRAVEL, 18: 5, 20: 9, 30: WEB, 37: YELLOW_FLOWER, 50: 20, 51: FIRE, 54: 41, 60: 29, 65: LADDER, 78: SNOW_LAYER, 79: ICE, 80: 23, 81: CACTUS, 82: 24, 83: REEDS };
export function toGame([id, meta]) {
  if (id === 31) return [39, 0]; // tall grass (metadata 1, the grass subtype)
  if (id === 59) return [31 + meta, 0]; // wheat stages are separate ids here
  if (!(id in MC_BLOCK)) throw new Error("no game block for " + id);
  return [MC_BLOCK[id], meta];
}
export const MC_OF = { 0: 0, 3: 1, [SAND]: 12, [GRAVEL]: 13, [CACTUS]: 81, [REEDS]: 83 };

// A map-backed world over an original-id fixture, as PlantProbe's W: set records [x, y, z, id, meta].
export class MockWorld {
  constructor(base) {
    this.base = base;
    this.cells = new Map();
    this.sets = [];
    this.onChange = null;
    this.edits = new Map();
  }
  key(x, y, z) { return `${x},${y},${z}`; }
  cell(x, y, z) { return this.cells.get(this.key(x, y, z)) ?? toGame(this.base(x, y, z)); }
  get(x, y, z) { return y > 255 ? 0 : this.cell(x, y, z)[0]; }
  getMeta(x, y, z) { return y > 255 ? 0 : this.cell(x, y, z)[1]; }
  solid(x, y, z) { const b = this.get(x, y, z); return solidBlock(b, b === SNOW_LAYER ? this.getMeta(x, y, z) : 0); }
  put(x, y, z, b, meta = 0) {
    if (y < 0 || y > 255) return false;
    this.cells.set(this.key(x, y, z), [b, meta]);
    return true;
  }
  set(x, y, z, b, track = true, meta = 0) {
    const old = this.get(x, y, z);
    if (!this.put(x, y, z, b, meta)) return false;
    this.sets.push([x, y, z, MC_OF[b] ?? -b, meta]);
    if (track) this.onChange?.(x, y, z, old, b);
    return true;
  }
}

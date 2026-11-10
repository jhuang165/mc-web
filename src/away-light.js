// Block light for the away run (batch 33, public/research/dimensions.md "Batch 33").
//
// The run's mobs read World.getBlockLightValue (zombie sunburn, path weights, brightness reads); before this the run answered from open sky only.
// This holds the block light of the columns the run loaded, at the fixed point LightVolume and RingLight keep (a cell takes its brightest
// neighbour minus max(1, opacity), cells with opacity 15 receive nothing, an emitting opaque block costs 1: ring-light.js OPACITY/EMISSION/COST),
// flooded once from every emitter. It costs nothing in a world with no emitter: the first scan finds none and `blockAt` answers 0 without a volume.
// Blocks change during a run (water, fire, explosions, commands): `touch` marks the volume stale when an emitter or an opacity changes and the next
// read re-floods at most once per REFLOOD_TICKS ticks, so a burning field or a flowing stream cannot make it run every tick.
import { OPACITY, EMISSION, COST } from "./ring-light.js";
import { useNeighborBrightness, lightEmission } from "./lighting.js";

// Blocks that emit only in a state the block id does not carry: a lit furnace (lightEmission(b, true), the position-dependent form LightVolume asks).
const STATE_EMITTER = new Uint8Array(256);
for (let b = 0; b < 256; b++) STATE_EMITTER[b] = lightEmission(b, true) > EMISSION[b] ? lightEmission(b, true) : 0;

export const REFLOOD_TICKS = 10;

export class AwayBlockLight {
  // `columns`: [{ x, z }] chunk coordinates the run holds. `world.get` is read for blocks.
  // `litFurnaces()`: the "x,y,z" keys of the furnaces burning now (batch 34); they emit 13 like a lit furnace block, and a change of that set re-floods.
  constructor(world, columns, litFurnaces = null) {
    this.world = world;
    this.litFurnaces = litFurnaces; this.litSig = "";
    this.h = world.height ?? 256;
    const xs = columns.map((c) => c.x), zs = columns.map((c) => c.z);
    this.cx0 = Math.min(...xs); this.cz0 = Math.min(...zs);
    this.w = Math.max(...xs) - this.cx0 + 1; this.d = Math.max(...zs) - this.cz0 + 1;
    this.held = new Set(columns.map((c) => `${c.x},${c.z}`));
    this.block = null;
    this.stale = true;
    this.tick = 0; this.floodedAt = -Infinity;
    this.emitters = 0; this.floods = 0; this.floodMs = 0; this.lastMs = 0;
  }
  has(x, z) { return this.held.has(`${Math.floor(x) >> 4},${Math.floor(z) >> 4}`); }
  // A block write at (x, y, z): the old and new block decide whether the light can have changed.
  touch(old, now) {
    if (old === now) return;
    if (EMISSION[old & 255] || EMISSION[now & 255] || (this.emitters && OPACITY[old & 255] !== OPACITY[now & 255])) this.stale = true; // with no emitter an opacity change cannot matter
  }
  index(x, y, z) { return (((x - this.cx0 * 16) * this.d * 16) + (z - this.cz0 * 16)) * this.h + y; }
  // Floods from every emitter in the held columns. Returns the number of emitters.
  flood(now = 0) {
    const t0 = typeof performance !== "undefined" ? performance.now() : 0;
    const H = this.h, W = this.w * 16, D = this.d * 16, x0 = this.cx0 * 16, z0 = this.cz0 * 16, world = this.world;
    const blocks = new Uint8Array(W * D * H);
    const light = this.block && this.block.length === W * D * H ? this.block.fill(0) : new Uint8Array(W * D * H);
    const buckets = Array.from({ length: 16 }, () => []);
    let emitters = 0;
    const lit = new Set(this.litFurnaces ? this.litFurnaces() : []);
    this.litSig = [...lit].sort().join("|");
    for (const key of this.held) {
      const [cx, cz] = key.split(",").map(Number);
      for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
        const x = cx * 16 + lx, z = cz * 16 + lz, base = ((x - x0) * D + (z - z0)) * H;
        for (let y = 0; y < H; y++) {
          const b = world.get(x, y, z) & 255;
          if (!b) continue;
          blocks[base + y] = b;
          const e = EMISSION[b] || (STATE_EMITTER[b] && lit.has(`${x},${y},${z}`) ? STATE_EMITTER[b] : 0);
          if (e) { light[base + y] = e; buckets[e].push(base + y); emitters++; }
        }
      }
    }
    // Spread by value: the highest level first, so every cell is final when it is taken.
    const sx = D * H, sz = H;
    for (let level = 15; level > 1; level--) {
      const list = buckets[level];
      for (let i = 0; i < list.length; i++) {
        const at = list[i];
        if (light[at] !== level) continue;
        const y = at % H, zi = Math.floor(at / H) % D, xi = Math.floor(at / sx);
        for (let n = 0; n < 6; n++) {
          let to;
          if (n === 0) { if (y + 1 >= H) continue; to = at + 1; }
          else if (n === 1) { if (y === 0) continue; to = at - 1; }
          else if (n === 2) { if (xi + 1 >= W) continue; to = at + sx; }
          else if (n === 3) { if (xi === 0) continue; to = at - sx; }
          else if (n === 4) { if (zi + 1 >= D) continue; to = at + sz; }
          else { if (zi === 0) continue; to = at - sz; }
          const b = blocks[to];
          if (OPACITY[b] >= 15) continue; // receives nothing (an emitter keeps its own value)
          const next = level - COST[b];
          if (next > light[to]) { light[to] = next; if (next > 1) buckets[next].push(to); }
        }
      }
    }
    this.block = emitters ? light : null;
    this.emitters = emitters; this.stale = false; this.floodedAt = now; this.floods++;
    if (t0) { this.lastMs = performance.now() - t0; this.floodMs += this.lastMs; }
    return emitters;
  }
  // Marks the run's clock; a stale volume is re-flooded here, at most once per REFLOOD_TICKS.
  refresh(now) {
    this.tick = now;
    if (this.litFurnaces && !this.stale && [...this.litFurnaces()].sort().join("|") !== this.litSig) this.stale = true; // a furnace lit or went out
    if (this.stale && (this.floods === 0 || now - this.floodedAt >= Math.max(REFLOOD_TICKS, this.lastMs * 2))) this.flood(now); // a slow flood waits longer: at most about a third of the run's time goes here
  }
  raw(x, y, z) {
    if (!this.block || y < 0 || y >= this.h) return 0;
    const xi = x - this.cx0 * 16, zi = z - this.cz0 * 16;
    if (xi < 0 || zi < 0 || xi >= this.w * 16 || zi >= this.d * 16) return 0;
    return this.block[(xi * this.d * 16 + zi) * this.h + y];
  }
  // LightVolume.packed's block half: a stair, slab, farmland or plant reads the brightest of its six neighbours.
  blockAt(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (this.stale && this.floods === 0) this.flood(this.tick);
    if (!this.block) return 0;
    const b = this.world.get(x, y, z) & 255;
    if (useNeighborBrightness(b)) {
      return Math.max(EMISSION[b], this.raw(x, y + 1, z), this.raw(x + 1, y, z), this.raw(x - 1, y, z), this.raw(x, y, z + 1), this.raw(x, y, z - 1), this.raw(x, y - 1, z));
    }
    return Math.max(this.raw(x, y, z), b ? EMISSION[b] : 0);
  }
}

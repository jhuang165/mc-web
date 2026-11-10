// Flowing water and lava from the 1.7.10 JAR: BlockDynamicLiquid (akr),
// BlockStaticLiquid (ant), BlockLiquid (alw), World.handleMaterialAcceleration
// (ahb.a(azt, awt, sa)) and the WorldServer scheduled-tick list (mt.a(IIIIII) /
// mt.a(Z), NextTickListEntry ahs). See public/research/fluids.md and lava.md.
//
// Water is block id 10 and lava block id 42, each with a 4-bit level in the
// world's metadata array: 0 is a source, 1-7 flowing and 8-15 falling (8 + the
// level it fell from). Vanilla ids 8/9 (water) and 10/11 (lava) are one block
// each: a still block is a flowing one without a pending scheduled tick, which
// is how BlockStaticLiquid.onNeighborBlockChange (ant.a) wakes it up.
//
// Lava differs from water in akr.a (updateTick): the level step is 2 in the
// overworld (1 where WorldProvider.isHellWorld, aqo.f), a rising level takes four times
// as long three times in four (the only use of the Random there), there is no
// infinite source, and lava may flow into water (it never lets water in). The
// BlockLiquid.func_149805_n hardening (obsidian for a source, cobblestone for
// level 4 or less, plus the fizz sound) runs on every neighbour change and on
// placement. Static lava's random fire spread (ant.a(.., Random)) lives in
// fire.js (lavaTick), driven by the random block ticks of the Fire runtime.

import { WATER, LAVA, REEDS, isLiquid } from "./world.js";
import { JavaRandom } from "./lighting.js";
import { saveTicks, readTicks } from "./scheduled-ticks.js";
import { pauseUnloadedTicks, ringBlockTickActive } from './streaming-ticks.js';

const f = Math.fround,
  STONE = 3,
  COBBLESTONE = 12,
  OBSIDIAN = 22;
// BlockLiquid.tickRate (alw.a(ahb)): 5 for water, 30 for lava (10 where `ahb.t.g` is set: both the Nether and the End; dimension-ticks-reference.json,
// bytecode-read. The same class has the field of the level step, `aqo.f`, set by the Nether only). WorldServer.tickUpdates takes at most 1000 entries
// per tick.
export const TICK_RATE = 5,
  LAVA_TICK_RATE = 30,
  NETHER_LAVA_TICK_RATE = 10,
  MAX_TICKS = 1000;
export const tickRate = (block, nether = false) => (block === LAVA ? (nether ? NETHER_LAVA_TICK_RATE : LAVA_TICK_RATE) : TICK_RATE);

// Neighbour order of World.notifyBlocksOfNeighborChange (ahb.d(IIILaji;)).
const NOTIFY = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
// BlockDynamicLiquid's horizontal directions: x - 1, x + 1, z - 1, z + 1.
const SIDES = [[-1, 0], [1, 0], [0, -1], [0, 1]];
// alw.n checks z - 1, z + 1, x - 1, x + 1 and y + 1 for water, never y - 1.
const HARDEN = [[0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0], [0, 1, 0]];

// Cells outside the 128 x 128 x 64 world count as solid, as do the bedrock
// below and the sky above; the original always has loaded chunks to read.
const solid = (w, x, y, z) => (w.inside && !w.inside(x, y, z)) || w.solid(x, y, z);
const level = (w, x, y, z) => w.getMeta?.(x, y, z) ?? 0;
// BlockLiquid.func_149804_e (alw.e(ahb, ...)): the raw level, -1 for other blocks.
const decay = (w, x, y, z, kind = WATER) => (w.get(x, y, z) === kind ? level(w, x, y, z) : -1);
// BlockLiquid.func_149798_e (alw.e(ahl, ...)): falling water counts as level 0.
const effective = (w, x, y, z, kind = WATER) => {
  const d = decay(w, x, y, z, kind);
  return d >= 8 ? 0 : d;
};
// BlockLiquid.func_149801_b (alw.b(I)): (level + 1) / 9 as a float, falling = full.
export const liquidHeightPercent = (meta) => f(f((meta >= 8 ? 0 : meta) + 1) / 9);

// RenderBlocks.getLiquidHeight (blm.a(IIILawt;)F): the surface height at a cell
// corner from the four cells around it, all in floats. Source and falling water
// weigh 11, flowing water 1, open non-liquid cells count as full height; water
// above any of the four makes the corner full.
export function liquidHeight(w, x, y, z, kind = WATER) {
  let n = 0, sum = 0;
  for (let i = 0; i < 4; i++) {
    const bx = x - (i & 1), bz = z - ((i >> 1) & 1);
    if (w.get(bx, y + 1, bz) === kind) return 1;
    if (w.get(bx, y, bz) === kind) {
      const meta = level(w, bx, y, bz);
      if (meta >= 8 || meta === 0) {
        sum = f(sum + f(liquidHeightPercent(meta) * 10));
        n += 10;
      }
      sum = f(sum + liquidHeightPercent(meta));
      n++;
    } else if (!w.solid(bx, y, bz)) {
      sum = f(sum + 1);
      n++;
    }
  }
  return f(1 - f(sum / n));
}

// Vec3.normalize (azw.a): the length is MathHelper.sqrt_double, a float.
export function normalize(x, y, z) {
  const d = f(Math.sqrt(x * x + y * y + z * z));
  return d < 1e-4 ? [0, 0, 0] : [x / d, y / d, z / d];
}

// BlockLiquid.getFlowVector (alw.f(ahl, III)): each neighbour pulls towards its
// lower level; a side that is open with water below pulls by that step; falling
// water next to a solid wall is pushed down by 6 before the final normalise.
export function flowVector(w, x, y, z, kind = WATER) {
  let vx = 0, vy = 0, vz = 0;
  const l = effective(w, x, y, z, kind);
  for (let i = 0; i < 4; i++) {
    let nx = x, nz = z;
    if (i === 0) nx--;
    if (i === 1) nz--;
    if (i === 2) nx++;
    if (i === 3) nz++;
    let n = effective(w, nx, y, nz, kind);
    if (n < 0) {
      if (!solid(w, nx, y, nz)) {
        n = effective(w, nx, y - 1, nz, kind);
        if (n >= 0) {
          const step = n - (l - 8);
          vx += (nx - x) * step;
          vz += (nz - z) * step;
        }
      }
    } else {
      const step = n - l;
      vx += (nx - x) * step;
      vz += (nz - z) * step;
    }
  }
  if (level(w, x, y, z) >= 8) {
    // BlockLiquid.isBlockSolid (alw.d(ahl, IIII)): another liquid is never solid.
    const wall = (wx, wy, wz) => w.get(wx, wy, wz) !== kind && solid(w, wx, wy, wz);
    if (
      wall(x, y, z - 1) || wall(x, y, z + 1) || wall(x - 1, y, z) || wall(x + 1, y, z) ||
      wall(x, y + 1, z - 1) || wall(x, y + 1, z + 1) || wall(x - 1, y + 1, z) || wall(x + 1, y + 1, z)
    ) {
      [vx, vy, vz] = normalize(vx, vy, vz);
      vy -= 6;
    }
  }
  return normalize(vx, vy, vz);
}

// BlockLiquid.func_149802_a (alw.a(ahl, IIILawt;)): the flow direction used to
// rotate the top texture, atan2(z, x) - pi/2; -1000 when the vector is flat.
export function flowAngle(w, x, y, z, kind = WATER) {
  const [vx, , vz] = flowVector(w, x, y, z, kind);
  return vx === 0 && vz === 0 ? -1000 : Math.atan2(vz, vx) - Math.PI / 2;
}

// World.handleMaterialAcceleration for water. `box` is [x0, y0, z0, x1, y1, z1].
// Every water cell whose surface reaches the box adds its flow vector; the sum
// is normalised and scaled by 0.014 when the entity is pushed by water.
// Returns { wet, push: [x, y, z] } with push in blocks per tick.
export function waterAcceleration(w, [x0, y0, z0, x1, y1, z1], pushed = true) {
  const ax = Math.floor(x0), bx = Math.floor(x1 + 1), ay = Math.floor(y0), by = Math.floor(y1 + 1), az = Math.floor(z0), bz = Math.floor(z1 + 1);
  let wet = false, vx = 0, vy = 0, vz = 0;
  for (let x = ax; x < bx; x++)
    for (let y = ay; y < by; y++)
      for (let z = az; z < bz; z++) {
        if (w.get(x, y, z) !== WATER) continue;
        if (by < f(f(y + 1) - liquidHeightPercent(level(w, x, y, z)))) continue;
        wet = true;
        const v = flowVector(w, x, y, z);
        vx += v[0];
        vy += v[1];
        vz += v[2];
      }
  if (f(Math.sqrt(vx * vx + vy * vy + vz * vz)) > 0 && pushed) {
    const n = normalize(vx, vy, vz);
    return { wet, push: [n[0] * 0.014, n[1] * 0.014, n[2] * 0.014] };
  }
  return { wet, push: [0, 0, 0] };
}
// Entity.handleWaterMovement (sa.N): the bounding box shrunk by 0.4 top and
// bottom (expand(0, -0.4000000059604645, 0)) and by 0.001 on every side.
export const entityWaterBox = ([x0, y0, z0, x1, y1, z1]) => [x0 + 0.001, y0 + 0.4000000059604645 + 0.001, z0 + 0.001, x1 - 0.001, y1 - 0.4000000059604645 - 0.001, z1 - 0.001];
// Entity.handleLavaMovement (sa.P): the box shrunk by 0.1 on the sides and 0.4
// top and bottom (expand(-0.1f, -0.4f, -0.1f)).
export const entityLavaBox = ([x0, y0, z0, x1, y1, z1]) => [x0 + 0.10000000149011612, y0 + 0.4000000059604645, z0 + 0.10000000149011612, x1 - 0.10000000149011612, y1 - 0.4000000059604645, z1 - 0.10000000149011612];
// World.isMaterialInBB (ahb.a(azt, awt)): any cell of the box's block range, with
// no check of the liquid's surface height (unlike handleMaterialAcceleration).
export function liquidInBox(w, [x0, y0, z0, x1, y1, z1], kind = LAVA) {
  const ax = Math.floor(x0), bx = Math.floor(x1 + 1), ay = Math.floor(y0), by = Math.floor(y1 + 1), az = Math.floor(z0), bz = Math.floor(z1 + 1);
  for (let x = ax; x < bx; x++) for (let y = ay; y < by; y++) for (let z = az; z < bz; z++) if (w.get(x, y, z) === kind) return true;
  return false;
}
// Entity.isInsideOfMaterial(water) (sa.a(awt)) at eye height `y` (posY + getEyeHeight): the
// eye's cell is water and the eye is below (j + 1) - (percent(meta) - 1/9).
export function eyeInWater(w, x, y, z) {
  const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
  if (w.get(bx, by, bz) !== WATER) return false;
  return y < f(f(by + 1) - f(liquidHeightPercent(w.getMeta?.(bx, by, bz) ?? 0) - f(0.11111111)));
}
// ActiveRenderInfo.getBlockAtEntityViewpoint (baj.a): the block at the eye, or
// the one above it once the eye is at least `meta / 9` below the top of a liquid
// cell (percent(meta) - 1/9). Water's own fog test in scene.js is separate.
export function viewpointBlock(w, x, y, z) {
  const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z), b = w.get(bx, by, bz);
  if (!isLiquid(b)) return b;
  const top = f(f(by + 1) - f(liquidHeightPercent(w.getMeta(bx, by, bz)) - f(0.11111111)));
  return y >= top ? w.get(bx, by + 1, bz) : b;
}
// Entity.handleLavaMovement for a bounding box [x0, y0, z0, x1, y1, z1].
export const inLava = (w, box) => liquidInBox(w, entityLavaBox(box), LAVA);

export class Fluids {
  // `wash(x, y, z, block)` is called before water replaces a block that is not
  // air (Block.dropBlockAsItem); the caller drops its items. `fizz(x, y, z,
  // pitch)` is BlockLiquid.func_149799_m's random.fizz at volume 0.5. `seed`
  // seeds a standalone Random; the game supplies World.rand as `random` so lava
  // ticks and fizz pitches share it with weather/fire/trees as in ahb.s.
  // `nether` selects the lava level step 1 (aqo.f, the Nether only); `skyless` the lava tick rate 10 (aqo.g: the Nether and the End,
  // default: the same as `nether`).
  constructor(world, { wash = () => {}, fizz = () => {}, seed = 0, random = new JavaRandom(seed), nether = false, skyless = nether } = {}) {
    this.world = world;
    this.wash = wash;
    this.onFizz = fizz;
    this.nether = nether;
    this.skyless = skyless;
    this.random = random;
    this.time = 0;
    this.serial = 0;
    this.ids = null; // the shared TickTree (tile-ticks.js) once the live game attaches one: creation ids then come from it
    this.heap = [];
    this.pending = new Map();
    this.changes = [];
    // Optional (x, y, z, old, now) called right after each native-style setBlock inside a run (place, setLevel, remove), where the native
    // World.setBlock notifies its neighbours at once. main.js points it at the redstone engine; unset, observers see only the drained list.
    this.onWrite = null;
    this.sources = 0;
    // World.setBlock(..., flag 1) from edits made outside the fluid code.
    world.onChange = (x, y, z, old, now) => {
      if (isLiquid(now)) this.added(x, y, z); // BlockDynamicLiquid.onBlockAdded (akr.b)
      this.notify(x, y, z);
    };
  }
  save() {
    return saveTicks(this.ids ? [...this.pending.values()].map((e) => ({ ...e, n: e.id })) : this.pending.values(), this.time);
  }
  load(data) {
    const state = readTicks(data, this.world, isLiquid);
    if (!state) { this.wake(); return; }
    this.time = state.time;
    this.serial = 0;
    this.heap = [];
    this.pending.clear();
    // Keep the scheduled block even if the cell has since changed. Until its
    // due tick, that entry must still suppress duplicates of the same block.
    for (const e of state.entries) this.enqueue(e.x, e.y, e.z, e.block, e.delay, e.p | 0, e.n);
  }
  // Legacy saves have no TileTicks equivalent. Wake liquids next to edits only
  // for those saves; an explicitly saved empty queue means settled liquids.
  wake() {
    const w = this.world, seen = new Set();
    for (const key of w.edits.keys()) {
      const [x, y, z] = key.split(",").map(Number);
      for (const [dx, dy, dz] of [[0, 0, 0], ...NOTIFY]) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (w.inside(nx, ny, nz) && isLiquid(w.get(nx, ny, nz)) && !seen.has(w.index(nx, ny, nz))) {
          seen.add(w.index(nx, ny, nz));
          this.schedule(nx, ny, nz);
        }
      }
    }
  }
  key(x, y, z, block) {
    if (this.world.streaming) return `${x},${y},${z}:${block}`;
    return this.world.index(x, y, z) * 2 + (block === LAVA ? 1 : 0);
  }
  // World.scheduleBlockUpdate (mt.a(IIILaji;II)): one entry per position and
  // block; a second request keeps the first one's time. The block is the liquid
  // at the position, the delay its tick rate unless given.
  schedule(x, y, z, delay, p = 0) {
    const block = this.world.get(x, y, z);
    if (!this.world.inside(x, y, z) || !isLiquid(block)) return;
    this.enqueue(x, y, z, block, delay ?? tickRate(block, this.skyless), p);
  }
  enqueue(x, y, z, block, delay, p = 0, n) {
    const key = this.key(x, y, z, block);
    if (this.pending.has(key)) return;
    const entry = { x, y, z, key, block, time: this.time + delay, p, id: this.ids ? this.ids.nextId() : this.serial++ };
    if (Number.isSafeInteger(n)) entry.n = n; // saved shared creation id: the order key when a TickTree attaches
    this.pending.set(key, entry);
    // Binary heap ordered like NextTickListEntry.compareTo: time, priority, then creation order.
    const h = this.heap, less = (a, b) => a.time < b.time || (a.time === b.time && (a.p < b.p || (a.p === b.p && a.id < b.id)));
    let i = h.push(entry) - 1;
    while (i > 0 && less(h[i], h[(i - 1) >> 1])) {
      [h[i], h[(i - 1) >> 1]] = [h[(i - 1) >> 1], h[i]];
      i = (i - 1) >> 1;
    }
  }
  pop() {
    const h = this.heap, top = h[0], last = h.pop(), less = (a, b) => a.time < b.time || (a.time === b.time && (a.p < b.p || (a.p === b.p && a.id < b.id)));
    if (h.length) {
      h[0] = last;
      for (let i = 0; ; ) {
        let m = i;
        for (const c of [2 * i + 1, 2 * i + 2]) if (c < h.length && less(h[c], h[m])) m = c;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    return top;
  }
  // BlockLiquid.onBlockAdded / BlockDynamicLiquid.onBlockAdded (alw.b, akr.b):
  // lava checks for water first, then a liquid that is still there schedules its tick.
  added(x, y, z) {
    this.harden(x, y, z);
    this.schedule(x, y, z);
  }
  // World.notifyBlocksOfNeighborChange: BlockLiquid.onNeighborBlockChange (alw.a)
  // runs the hardening check, and BlockStaticLiquid.onNeighborBlockChange
  // (ant.a) then turns a still neighbour into a flowing one. That is a
  // setBlock(flowing, flag 2), whose onBlockAdded (akr.b) checks again before it
  // schedules the tick. A lava cell with a pending tick is the flowing block,
  // which only runs the first check; water has no check at all.
  notify(x, y, z) {
    const w = this.world;
    for (const [dx, dy, dz] of NOTIFY) {
      const nx = x + dx, ny = y + dy, nz = z + dz, b = w.get(nx, ny, nz);
      if (b === WATER) this.schedule(nx, ny, nz);
      else if (b === LAVA) {
        const still = w.inside(nx, ny, nz) && !this.pending.has(this.key(nx, ny, nz, LAVA));
        this.harden(nx, ny, nz);
        if (still && w.get(nx, ny, nz) === LAVA) this.added(nx, ny, nz);
      }
    }
  }
  // BlockLiquid.func_149805_n (alw.n): lava with water on any side but below
  // turns to obsidian (a source), cobblestone (level 4 or less) or stays, and
  // always fizzes.
  harden(x, y, z) {
    const w = this.world;
    if (w.get(x, y, z) !== LAVA) return;
    if (!HARDEN.some(([dx, dy, dz]) => w.get(x + dx, y + dy, z + dz) === WATER)) return;
    const meta = level(w, x, y, z);
    if (meta === 0) this.place(x, y, z, OBSIDIAN, 0);
    else if (meta <= 4) this.place(x, y, z, COBBLESTONE, 0);
    this.fizz(x, y, z);
  }
  // BlockLiquid.func_149799_m (alw.m): random.fizz at the cell centre, volume
  // 0.5, pitch 2.6 + (r1 - r2) * 0.8 in floats. (Its 8 largesmoke particles use
  // Math.random, not the world Random.)
  fizz(x, y, z) {
    const r = this.random, a = r.nextFloat(), b = r.nextFloat();
    this.onFizz(x + 0.5, y + 0.5, z + 0.5, f(f(2.6) + f(f(a - b) * f(0.8))));
  }
  // WorldServer.tickUpdates: up to 1000 due entries in (time, creation) order.
  // Each entry leaves the pending set as it is taken and runs at once (so a
  // later entry for the same cell still blocks a duplicate), unless its block
  // is no longer the one that was scheduled. Returns the cells changed as [x,
  // y, z, oldBlock, newBlock] (equal blocks mean only the level changed).
  tick() {
    this.beginTick();
    for (let n = Math.min(this.heap.length, MAX_TICKS); n > 0 && this.heap[0].time <= this.time; n--) this.run(this.take());
    return this.drain();
  }
  // The pieces of tick() the shared tick tree (tile-ticks.js TickTree) drives: the clock and ring pause, the head entry, taking it out of the
  // pending set, running a taken entry, and the cells changed so far.
  beginTick() {
    this.time++;
    // Entries in held ring columns run too (natural-spawning.md "Round 7"); their writes go to the ring (World.ringSink).
    pauseUnloadedTicks(this.world, this.heap, (x, z) => ringBlockTickActive(this.world, x, z, 5)); // the flow search is 4 deep
  }
  take() {
    const e = this.pop();
    this.pending.delete(e.key);
    return e;
  }
  run({ x, y, z, block }) {
    if (this.world.get(x, y, z) === block) this.updateTick(x, y, z);
  }
  drain() {
    const changes = this.changes;
    this.changes = [];
    return changes;
  }
  // World.setBlock(x, y, z, block, level, 3): onBlockAdded schedules the tick,
  // then the neighbours are notified.
  place(x, y, z, block, meta) {
    const old = this.world.get(x, y, z);
    if (!this.world.put(x, y, z, block, meta)) return;
    this.changes.push([x, y, z, old, block]);
    if (isLiquid(block)) this.added(x, y, z);
    this.notify(x, y, z);
    this.onWrite?.(x, y, z, old, block);
  }
  // World.setBlockMetadataWithNotify(..., flag 2): no neighbour notification.
  setLevel(x, y, z, kind, meta) {
    if (this.world.put(x, y, z, kind, meta)) { this.changes.push([x, y, z, kind, kind]); this.onWrite?.(x, y, z, kind, kind); }
  }
  // World.setBlockToAir (flag 3).
  remove(x, y, z, kind) {
    if (this.world.put(x, y, z, 0, 0)) {
      this.changes.push([x, y, z, kind, 0]);
      this.notify(x, y, z);
      this.onWrite?.(x, y, z, kind, 0);
    }
  }
  // BlockDynamicLiquid.func_149807_p (akr.p): doors, signs, ladders, reeds and
  // portals block liquid, as does any material that blocks movement. Of the first
  // group ladders (they have a collision box) and sugar cane exist here; air,
  // liquids, torches and the other plants are the open cells.
  blocked(x, y, z) {
    return (this.world.get(x,y,z)!==73&&solid(this.world, x, y, z)) || this.world.get(x, y, z) === REEDS;
  }
  // func_149809_q (akr.q): not the same liquid, not lava, and not blocked.
  // Water therefore never flows into lava, while lava can flow into water.
  canFlowInto(x, y, z, kind) {
    const b = this.world.get(x, y, z);
    return b !== kind && b !== LAVA && !this.blocked(x, y, z);
  }
  // func_149810_a (akr.a(ahb, IIII)): the lowest neighbouring level so far,
  // counting adjacent sources.
  adjacent(x, y, z, lowest, kind) {
    let d = decay(this.world, x, y, z, kind);
    if (d < 0) return lowest;
    if (d === 0) this.sources++;
    if (d >= 8) d = 0;
    return lowest >= 0 && d >= lowest ? lowest : d;
  }
  // func_149813_h (akr.h): a liquid takes an open cell. Water washes away what
  // was there (dropping its items); lava fizzes and destroys it silently.
  flowInto(x, y, z, meta, kind) {
    if (!this.canFlowInto(x, y, z, kind)) return;
    const old = this.world.get(x, y, z);
    if (kind === LAVA) this.fizz(x, y, z);
    else if (old) this.wash(x, y, z, old);
    this.place(x, y, z, kind, meta);
  }
  // func_149812_c (akr.c): the fewest steps (searching four deep) from this
  // cell to a drop, never going back where it came from.
  cost(x, y, z, depth, from, kind) {
    let best = 1000;
    for (let i = 0; i < 4; i++) {
      if ((i === 0 && from === 1) || (i === 1 && from === 0) || (i === 2 && from === 3) || (i === 3 && from === 2)) continue;
      const nx = x + SIDES[i][0], nz = z + SIDES[i][1];
      if (this.blocked(nx, y, nz)) continue;
      if (this.world.get(nx, y, nz) === kind && level(this.world, nx, y, nz) === 0) continue;
      if (!this.blocked(nx, y - 1, nz)) return depth;
      if (depth < 4) best = Math.min(best, this.cost(nx, y, nz, depth + 1, i, kind));
    }
    return best;
  }
  // func_149808_o (akr.o): the directions with the lowest cost.
  directions(x, y, z, kind) {
    const costs = [1000, 1000, 1000, 1000];
    for (let i = 0; i < 4; i++) {
      const nx = x + SIDES[i][0], nz = z + SIDES[i][1];
      if (this.blocked(nx, y, nz)) continue;
      if (this.world.get(nx, y, nz) === kind && level(this.world, nx, y, nz) === 0) continue;
      costs[i] = this.blocked(nx, y - 1, nz) ? this.cost(nx, y, nz, 1, i, kind) : 0;
    }
    const low = Math.min(...costs);
    return costs.map((c) => c === low);
  }
  // BlockDynamicLiquid.func_149811_n (akr.n): a liquid whose level is settled
  // becomes the still block, here simply one without a pending tick. Setting the
  // still block runs its onBlockAdded (alw.b), the lava hardening check, once more.
  settle(x, y, z) {
    this.harden(x, y, z);
  }
  // BlockDynamicLiquid.updateTick (akr.a(ahb, IIILjava/util/Random;)V).
  updateTick(x, y, z) {
    const w = this.world, kind = w.get(x, y, z), lava = kind === LAVA;
    // var7: the level step (2 for lava except where WorldProvider.isHellWorld, aqo.f: the Nether).
    const step = lava && !this.nether ? 2 : 1;
    let rate = tickRate(kind, this.skyless);
    let l = decay(w, x, y, z, kind);
    if (l > 0) {
      this.sources = 0;
      let lowest = -100;
      for (const [dx, dz] of SIDES) lowest = this.adjacent(x + dx, y, z + dz, lowest, kind);
      let next = lowest + step;
      if (next >= 8 || lowest < 0) next = -1;
      const above = decay(w, x, y + 1, z, kind);
      if (above >= 0) next = above >= 8 ? above : above + 8;
      // Two adjacent water sources over a solid block or another source make a
      // source; lava has no such rule.
      if (this.sources >= 2 && !lava) {
        if (solid(w, x, y - 1, z)) next = 0;
        else if (w.get(x, y - 1, z) === WATER && level(w, x, y - 1, z) === 0) next = 0;
      }
      // Lava that is about to rise a level waits four times as long, three times in four.
      if (lava && l < 8 && next < 8 && next > l && this.random.nextInt(4) !== 0) rate *= 4;
      if (next === l) this.settle(x, y, z);
      else {
        l = next;
        if (next < 0) this.remove(x, y, z, kind);
        else {
          this.setLevel(x, y, z, kind, next);
          this.schedule(x, y, z, rate);
          this.notify(x, y, z);
        }
      }
    } else this.settle(x, y, z);
    if (this.canFlowInto(x, y - 1, z, kind)) {
      // Lava falling onto water leaves stone and does not spread.
      if (lava && w.get(x, y - 1, z) === WATER) {
        this.place(x, y - 1, z, STONE, 0);
        this.fizz(x, y - 1, z);
        return;
      }
      this.flowInto(x, y - 1, z, l >= 8 ? l : l + 8, kind);
    } else if (l >= 0 && (l === 0 || this.blocked(x, y - 1, z))) {
      const open = this.directions(x, y, z, kind);
      let spread = l + step;
      if (l >= 8) spread = 1;
      if (spread >= 8) return;
      SIDES.forEach(([dx, dz], i) => {
        if (open[i]) this.flowInto(x + dx, y, z + dz, spread, kind);
      });
    }
  }
}

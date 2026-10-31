// Flowing water from the 1.7.10 JAR: BlockDynamicLiquid (akr), BlockStaticLiquid
// (ant), BlockLiquid (alw), World.handleMaterialAcceleration (ahb.a(azt, awt, sa))
// and the WorldServer scheduled-tick list (mt.a(IIIIII) / mt.a(Z), NextTickListEntry
// ahs). See public/research/fluids.md.
//
// Water here is block id 10 with a 4-bit level in the world's metadata array:
// 0 is a source, 1-7 flowing and 8-15 falling (8 + the level it fell from).
// Block ids 8 (flowing) and 9 (still) are one block: a still block is a flowing
// one without a pending scheduled tick, which is how BlockStaticLiquid.
// onNeighborBlockChange (ant.a) wakes it up. Lava does not exist in this build,
// so every lava branch (Material.lava rate 30, hardening, fizz) is left out.

const WATER = 10,
  f = Math.fround;
// BlockLiquid.tickRate (alw.a(ahb)): 5 for water. WorldServer.tickUpdates takes
// at most 1000 entries per tick.
export const TICK_RATE = 5,
  MAX_TICKS = 1000;

// Neighbour order of World.notifyBlocksOfNeighborChange (ahb.d(IIILaji;)).
const NOTIFY = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
// BlockDynamicLiquid's horizontal directions: x - 1, x + 1, z - 1, z + 1.
const SIDES = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// Cells outside the 128 x 128 x 64 world count as solid, as do the bedrock
// below and the sky above; the original always has loaded chunks to read.
const solid = (w, x, y, z) => (w.inside && !w.inside(x, y, z)) || w.solid(x, y, z);
const level = (w, x, y, z) => w.getMeta?.(x, y, z) ?? 0;
// BlockLiquid.func_149804_e (alw.e(ahb, ...)): the raw level, -1 for other blocks.
const decay = (w, x, y, z) => (w.get(x, y, z) === WATER ? level(w, x, y, z) : -1);
// BlockLiquid.func_149798_e (alw.e(ahl, ...)): falling water counts as level 0.
const effective = (w, x, y, z) => {
  const d = decay(w, x, y, z);
  return d >= 8 ? 0 : d;
};
// BlockLiquid.func_149801_b (alw.b(I)): (level + 1) / 9 as a float, falling = full.
export const liquidHeightPercent = (meta) => f(f((meta >= 8 ? 0 : meta) + 1) / 9);

// RenderBlocks.getLiquidHeight (blm.a(IIILawt;)F): the surface height at a cell
// corner from the four cells around it, all in floats. Source and falling water
// weigh 11, flowing water 1, open non-liquid cells count as full height; water
// above any of the four makes the corner full.
export function liquidHeight(w, x, y, z) {
  let n = 0, sum = 0;
  for (let i = 0; i < 4; i++) {
    const bx = x - (i & 1), bz = z - ((i >> 1) & 1);
    if (w.get(bx, y + 1, bz) === WATER) return 1;
    if (w.get(bx, y, bz) === WATER) {
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
export function flowVector(w, x, y, z) {
  let vx = 0, vy = 0, vz = 0;
  const l = effective(w, x, y, z);
  for (let i = 0; i < 4; i++) {
    let nx = x, nz = z;
    if (i === 0) nx--;
    if (i === 1) nz--;
    if (i === 2) nx++;
    if (i === 3) nz++;
    let n = effective(w, nx, y, nz);
    if (n < 0) {
      if (!solid(w, nx, y, nz)) {
        n = effective(w, nx, y - 1, nz);
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
    const wall = (wx, wy, wz) => w.get(wx, wy, wz) !== WATER && solid(w, wx, wy, wz);
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
export function flowAngle(w, x, y, z) {
  const [vx, , vz] = flowVector(w, x, y, z);
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

export class Fluids {
  // `wash(x, y, z, block)` is called before water replaces a block that is not
  // air (Block.dropBlockAsItem); the caller drops its items.
  constructor(world, { wash = () => {} } = {}) {
    this.world = world;
    this.wash = wash;
    this.time = 0;
    this.serial = 0;
    this.heap = [];
    this.pending = new Map();
    this.changes = [];
    this.sources = 0;
    // World.setBlock(..., flag 1) from edits made outside the fluid code.
    world.onChange = (x, y, z, old, now) => {
      if (now === WATER) this.schedule(x, y, z); // BlockDynamicLiquid.onBlockAdded (akr.b)
      this.notify(x, y, z);
    };
  }
  // Saves keep no scheduled ticks (the original stores them as TileTicks), so a
  // loaded world wakes every water cell touching an edited cell; a settled one
  // goes back to rest after a single tick.
  wake() {
    const w = this.world, seen = new Set();
    for (const key of w.edits.keys()) {
      const [x, y, z] = key.split(",").map(Number);
      for (const [dx, dy, dz] of [[0, 0, 0], ...NOTIFY]) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (w.inside(nx, ny, nz) && w.get(nx, ny, nz) === WATER && !seen.has(w.index(nx, ny, nz))) {
          seen.add(w.index(nx, ny, nz));
          this.schedule(nx, ny, nz);
        }
      }
    }
  }
  // World.scheduleBlockUpdate (mt.a(IIILaji;II)): one entry per position and
  // block; a second request keeps the first one's time.
  schedule(x, y, z, delay = TICK_RATE) {
    if (!this.world.inside(x, y, z)) return;
    const key = this.world.index(x, y, z);
    if (this.pending.has(key)) return;
    const entry = { x, y, z, key, time: this.time + delay, id: this.serial++ };
    this.pending.set(key, entry);
    // Binary heap ordered like NextTickListEntry.compareTo: time, then creation order.
    const h = this.heap, less = (a, b) => a.time < b.time || (a.time === b.time && a.id < b.id);
    let i = h.push(entry) - 1;
    while (i > 0 && less(h[i], h[(i - 1) >> 1])) {
      [h[i], h[(i - 1) >> 1]] = [h[(i - 1) >> 1], h[i]];
      i = (i - 1) >> 1;
    }
  }
  pop() {
    const h = this.heap, top = h[0], last = h.pop(), less = (a, b) => a.time < b.time || (a.time === b.time && a.id < b.id);
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
  // World.notifyBlocksOfNeighborChange: BlockStaticLiquid.onNeighborBlockChange
  // (ant.a) turns a still neighbour into a flowing one and schedules its tick.
  notify(x, y, z) {
    for (const [dx, dy, dz] of NOTIFY) if (this.world.get(x + dx, y + dy, z + dz) === WATER) this.schedule(x + dx, y + dy, z + dz);
  }
  // WorldServer.tickUpdates: up to 1000 due entries in (time, creation) order.
  // Each entry leaves the pending set as it is taken and runs at once (so a
  // later entry for the same cell still blocks a duplicate), unless its block
  // is no longer water. Returns the cells changed as [x, y, z, oldBlock,
  // newBlock] (equal blocks mean only the level changed).
  tick() {
    this.time++;
    for (let n = Math.min(this.heap.length, MAX_TICKS); n > 0 && this.heap[0].time <= this.time; n--) {
      const { x, y, z, key } = this.pop();
      this.pending.delete(key);
      if (this.world.get(x, y, z) === WATER) this.updateTick(x, y, z);
    }
    const changes = this.changes;
    this.changes = [];
    return changes;
  }
  // World.setBlock(x, y, z, water, level, 3): onBlockAdded schedules the tick,
  // then the neighbours are notified.
  place(x, y, z, meta) {
    const old = this.world.get(x, y, z);
    if (!this.world.put(x, y, z, WATER, meta)) return;
    this.changes.push([x, y, z, old, WATER]);
    this.schedule(x, y, z);
    this.notify(x, y, z);
  }
  // World.setBlockMetadataWithNotify(..., flag 2): no neighbour notification.
  setLevel(x, y, z, meta) {
    if (this.world.put(x, y, z, WATER, meta)) this.changes.push([x, y, z, WATER, WATER]);
  }
  // World.setBlockToAir (flag 3).
  remove(x, y, z) {
    if (this.world.put(x, y, z, 0, 0)) {
      this.changes.push([x, y, z, WATER, 0]);
      this.notify(x, y, z);
    }
  }
  // BlockDynamicLiquid.func_149807_p (akr.p): doors, signs, ladders, reeds and
  // portals block liquid, as does any material that blocks movement. None of the
  // first group exists here; air, water, torches and plants are the open cells.
  blocked(x, y, z) {
    return solid(this.world, x, y, z);
  }
  // func_149809_q (akr.q): not water, not lava, and not blocked.
  canFlowInto(x, y, z) {
    return this.world.get(x, y, z) !== WATER && !this.blocked(x, y, z);
  }
  // func_149810_a (akr.a(ahb, IIII)): the lowest neighbouring level so far,
  // counting adjacent sources.
  adjacent(x, y, z, lowest) {
    let d = decay(this.world, x, y, z);
    if (d < 0) return lowest;
    if (d === 0) this.sources++;
    if (d >= 8) d = 0;
    return lowest >= 0 && d >= lowest ? lowest : d;
  }
  // func_149813_h (akr.h): water takes an open cell, washing away what was there.
  flowInto(x, y, z, meta) {
    if (!this.canFlowInto(x, y, z)) return;
    const old = this.world.get(x, y, z);
    if (old) this.wash(x, y, z, old);
    this.place(x, y, z, meta);
  }
  // func_149812_c (akr.c): the fewest steps (searching four deep) from this
  // cell to a drop, never going back where it came from.
  cost(x, y, z, depth, from) {
    let best = 1000;
    for (let i = 0; i < 4; i++) {
      if ((i === 0 && from === 1) || (i === 1 && from === 0) || (i === 2 && from === 3) || (i === 3 && from === 2)) continue;
      const nx = x + SIDES[i][0], nz = z + SIDES[i][1];
      if (this.blocked(nx, y, nz)) continue;
      if (this.world.get(nx, y, nz) === WATER && level(this.world, nx, y, nz) === 0) continue;
      if (!this.blocked(nx, y - 1, nz)) return depth;
      if (depth < 4) best = Math.min(best, this.cost(nx, y, nz, depth + 1, i));
    }
    return best;
  }
  // func_149808_o (akr.o): the directions with the lowest cost.
  directions(x, y, z) {
    const costs = [1000, 1000, 1000, 1000];
    for (let i = 0; i < 4; i++) {
      const nx = x + SIDES[i][0], nz = z + SIDES[i][1];
      if (this.blocked(nx, y, nz)) continue;
      if (this.world.get(nx, y, nz) === WATER && level(this.world, nx, y, nz) === 0) continue;
      costs[i] = this.blocked(nx, y - 1, nz) ? this.cost(nx, y, nz, 1, i) : 0;
    }
    const low = Math.min(...costs);
    return costs.map((c) => c === low);
  }
  // BlockDynamicLiquid.updateTick (akr.a(ahb, IIILjava/util/Random;)V), water only.
  updateTick(x, y, z) {
    const w = this.world;
    let l = decay(w, x, y, z);
    if (l > 0) {
      this.sources = 0;
      let lowest = -100;
      for (const [dx, dz] of SIDES) lowest = this.adjacent(x + dx, y, z + dz, lowest);
      let next = lowest + 1;
      if (next >= 8 || lowest < 0) next = -1;
      const above = decay(w, x, y + 1, z);
      if (above >= 0) next = above >= 8 ? above : above + 8;
      // Two adjacent sources over a solid block or another source make a source.
      if (this.sources >= 2) {
        if (solid(w, x, y - 1, z)) next = 0;
        else if (w.get(x, y - 1, z) === WATER && level(w, x, y - 1, z) === 0) next = 0;
      }
      if (next !== l) {
        l = next;
        if (next < 0) this.remove(x, y, z);
        else {
          this.setLevel(x, y, z, next);
          this.schedule(x, y, z);
          this.notify(x, y, z);
        }
      }
      // (When next === l the block turns still: here, it simply has no pending tick.)
    }
    if (this.canFlowInto(x, y - 1, z)) this.flowInto(x, y - 1, z, l >= 8 ? l : l + 8);
    else if (l >= 0 && (l === 0 || this.blocked(x, y - 1, z))) {
      const open = this.directions(x, y, z);
      let spread = l + 1;
      if (l >= 8) spread = 1;
      if (spread >= 8) return;
      SIDES.forEach(([dx, dz], i) => {
        if (open[i]) this.flowInto(x + dx, y, z + dz, spread);
      });
    }
  }
}

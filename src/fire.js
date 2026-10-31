// Minecraft Java 1.7.10 fire: BlockFire (alb) with its encouragement and
// flammability tables, updateTick (spread, burn-out, rain), canPlaceBlockAt,
// onBlockAdded and onNeighborBlockChange; the fire that BlockStaticLiquid (ant)
// lava and EntityLightningBolt (xh) start; World.isBoundingBoxBurning (ahb.e) and
// RenderBlocks.renderBlockFire (blm.a). Evidence and gaps: public/research/fire.md;
// everything here is replayed against public/research/fire-reference.json (the
// unchanged original classes, tools/probes/FireProbe.java) by fire.test.js.
//
// The rules are functions of a level adapter `L` so the tests can drive them over
// the probe's fixtures: get(x, y, z) / meta(x, y, z) read the world, setBlock(x, y,
// z, id, meta) is World.setBlock(.., 3), setAir is setBlockToAir, setMeta is
// setBlockMetadataWithNotify(.., 4), schedule(x, y, z, delay) is
// scheduleBlockUpdate, raining() is isRaining, strike(x, y, z) is
// canLightningStrikeAt, humid(x, y, z) is isBlockHighHumidity, and `rand`,
// `difficulty` and `fireTick` (the doFireTick game rule) complete it.
import { FIRE, LAVA, HEIGHT, SIZE, isLiquid, normalCube } from "./world.js";
import { Weather, canLightningStrikeAt, stopsPrecipitation } from "./weather.js";

const f = Math.fround;

// Blocks.fire.setFireInfo(block, chanceToEncourageFire, abilityToCatchFire) for the
// blocks of this build (internal ids): logs 5/5, leaves 30/60, planks 5/20,
// wool 30/60, bookshelf 30/20, tall grass and flowers 60/100. Other blocks have 0/0.
// (The probe dumps the whole 256-entry table: fire-reference.json "table".)
export const FIRE_INFO = { 4: [5, 5], 5: [30, 60], 7: [5, 20], 19: [30, 60], 21: [30, 20], 39: [60, 100], 43: [60, 100], 44: [60, 100] };
export const encouragement = (b) => FIRE_INFO[b]?.[0] ?? 0;
export const flammability = (b) => FIRE_INFO[b]?.[1] ?? 0;
// Material.getCanBurn (awt.h), which BlockStaticLiquid.func_149...(o) reads: wood, cloth,
// leaves and plants. Logs, leaves, planks, crafting table, wool, bookshelf, chest,
// tall grass; flowers (Material.plants) cannot burn, tall grass (Material.vine) can.
export const BURNS = new Set([4, 5, 7, 13, 19, 21, 39, 41]);
// World.doesBlockHaveSolidTopSurface (ahb.a(ahl, x, y, z)): an opaque normal cube.
// Leaves, glass, farmland, chests, liquids and plants have none.
export const solidTop = (b) => normalCube(b);
// Material.blocksMovement (awt.c): everything but air, liquids, torches, plants and fire.
export const blocksMovement = (b) => stopsPrecipitation(b) && !isLiquid(b);
// The difficulty is not a setting of this build: Normal (EnumDifficulty id 2) is assumed.
export const DIFFICULTY = 2;
// Entity.setFire(8) is 8 * 20 ticks; the burning-ticks counter this build keeps has 0 where
// vanilla has -fireResistance.
export const FIRE_TICKS = 160;

const SIDES = [[1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];

// BlockFire.canCatchFire (alb.e(ahl, ...)): the block there has chanceToEncourageFire > 0.
export const canCatchFire = (L, x, y, z) => encouragement(L.get(x, y, z)) > 0;
// BlockFire.canNeighborBurn (alb.e(ahb, ...)).
export const canNeighborBurn = (L, x, y, z) => SIDES.some(([dx, dy, dz]) => canCatchFire(L, x + dx, y + dy, z + dz));
// BlockFire.canPlaceBlockAt (alb.c): a solid top below, or a flammable neighbour.
export const canPlace = (L, x, y, z) => solidTop(L.get(x, y - 1, z)) || canNeighborBurn(L, x, y, z);
// BlockFire.getChanceOfNeighborsEncouragingFire (alb.m): 0 unless the cell is air, else the
// largest chanceToEncourageFire of its six neighbours.
export function neighborsEncourage(L, x, y, z) {
  if (L.get(x, y, z) !== 0) return 0;
  let best = 0;
  for (const [dx, dy, dz] of SIDES) best = Math.max(best, encouragement(L.get(x + dx, y + dy, z + dz)));
  return best;
}
// Random.nextInt(5) / 4 in Java ints: 1 once in five.
const quarter = (r) => (r.nextInt(5) / 4) | 0;

// BlockFire.tryCatchFire (alb.a(ahb, x, y, z, chance, Random, age)): a roll against the
// block's flammability burns it, becoming a younger fire or nothing (TNT is not in this build).
export function tryCatchFire(L, x, y, z, chance, age) {
  const flam = flammability(L.get(x, y, z));
  if (L.rand.nextInt(chance) >= flam) return;
  if (L.rand.nextInt(age + 10) < 5 && !L.strike(x, y, z)) L.setBlock(x, y, z, FIRE, Math.min(15, age + quarter(L.rand)));
  else L.setAir(x, y, z);
}

// BlockFire.updateTick (alb.a(ahb, x, y, z, Random)). `flag` of the original (fire over
// netherrack, or over bedrock in the End) is always false here.
export function updateTick(L, x, y, z) {
  if (!L.fireTick) return;
  if (!canPlace(L, x, y, z)) L.setAir(x, y, z); // no return: the rest still runs
  if (L.raining() && (L.strike(x, y, z) || L.strike(x - 1, y, z) || L.strike(x + 1, y, z) || L.strike(x, y, z - 1) || L.strike(x, y, z + 1))) {
    L.setAir(x, y, z);
    return;
  }
  const r = L.rand, age = L.meta(x, y, z);
  if (age < 15) L.setMeta(x, y, z, age + ((r.nextInt(3) / 2) | 0));
  L.schedule(x, y, z, 30 + r.nextInt(10));
  if (!canNeighborBurn(L, x, y, z)) {
    if (!solidTop(L.get(x, y - 1, z)) || age > 3) L.setAir(x, y, z);
    return;
  }
  if (!canCatchFire(L, x, y - 1, z) && age === 15 && r.nextInt(4) === 0) {
    L.setAir(x, y, z);
    return;
  }
  const humid = L.humid(x, y, z), h = humid ? -50 : 0;
  tryCatchFire(L, x + 1, y, z, 300 + h, age);
  tryCatchFire(L, x - 1, y, z, 300 + h, age);
  tryCatchFire(L, x, y - 1, z, 250 + h, age);
  tryCatchFire(L, x, y + 1, z, 250 + h, age);
  tryCatchFire(L, x, y, z - 1, 300 + h, age);
  tryCatchFire(L, x, y, z + 1, 300 + h, age);
  for (let i = x - 1; i <= x + 1; i++)
    for (let k = z - 1; k <= z + 1; k++)
      for (let j = y - 1; j <= y + 4; j++) {
        if (i === x && j === y && k === z) continue;
        let range = 100;
        if (j > y + 1) range += (j - (y + 1)) * 100;
        const e = neighborsEncourage(L, i, j, k);
        if (e <= 0) continue;
        let chance = Math.trunc((e + 40 + L.difficulty * 7) / (age + 30));
        if (humid) chance = Math.trunc(chance / 2);
        // The original asks canLightningStrikeAt(i - 1, j, z) with the fire's own z, not k.
        if (chance > 0 && r.nextInt(range) <= chance && (!L.raining() || !L.strike(i, j, k)) && !L.strike(i - 1, j, z) && !L.strike(i + 1, j, k) && !L.strike(i, j, k - 1) && !L.strike(i, j, k + 1))
          L.setBlock(i, j, k, FIRE, Math.min(15, age + quarter(r)));
      }
}
// BlockFire.onNeighborBlockChange (alb.a(ahb, x, y, z, Block)).
export function neighborChange(L, x, y, z) {
  if (!solidTop(L.get(x, y - 1, z)) && !canNeighborBurn(L, x, y, z)) L.setAir(x, y, z);
}
// BlockFire.onBlockAdded (alb.b); the nether portal check (dimension <= 0) has no portal to find.
export function blockAdded(L, x, y, z) {
  if (!solidTop(L.get(x, y - 1, z)) && !canNeighborBurn(L, x, y, z)) L.setAir(x, y, z);
  else L.schedule(x, y, z, 30 + L.rand.nextInt(10));
}

// BlockStaticLiquid.updateTick (ant.a(ahb, x, y, z, Random)) for lava: up to three random
// steps up (and sideways), the first air cell with a burnable neighbour catches fire, a
// solid cell stops it; with no steps it tries three neighbouring columns at the lava's own
// height. There is no doFireTick check in this method.
export function lavaTick(L, x, y, z) {
  const r = L.rand, n = r.nextInt(3), burns = (a, b, c) => BURNS.has(L.get(a, b, c));
  let cx = x, cy = y, cz = z;
  for (let i = 0; i < n; i++) {
    cx += r.nextInt(3) - 1;
    cy++;
    cz += r.nextInt(3) - 1;
    const b = L.get(cx, cy, cz);
    if (b === 0) {
      if (burns(cx - 1, cy, cz) || burns(cx + 1, cy, cz) || burns(cx, cy - 1, cz) || burns(cx, cy + 1, cz) || burns(cx, cy, cz - 1) || burns(cx, cy, cz + 1)) {
        L.setBlock(cx, cy, cz, FIRE, 0);
        return;
      }
    } else if (blocksMovement(b)) return;
  }
  if (n === 0)
    for (let i = 0; i < 3; i++) {
      const px = x + r.nextInt(3) - 1, pz = z + r.nextInt(3) - 1;
      if (L.get(px, y + 1, pz) === 0 && burns(px, y, pz)) L.setBlock(px, y + 1, pz, FIRE, 0);
    }
}

// EntityLightningBolt (xh): placed when the bolt is made (Normal and Hard only, 5 tries
// around the strike with the bolt's own Random) and again on each re-strike, which has no
// difficulty check. `bolt` is {x, y, z, random}; both need the doFireTick rule.
const strikeCell = (L, x, y, z) => {
  if (L.get(x, y, z) === 0 && canPlace(L, x, y, z)) L.setBlock(x, y, z, FIRE, 0);
};
export function boltStart(L, bolt) {
  if (!L.fireTick || L.difficulty < 2) return;
  const x = Math.floor(bolt.x), y = Math.floor(bolt.y), z = Math.floor(bolt.z), r = bolt.random;
  strikeCell(L, x, y, z);
  for (let i = 0; i < 4; i++) {
    const px = x + r.nextInt(3) - 1, py = y + r.nextInt(3) - 1, pz = z + r.nextInt(3) - 1;
    strikeCell(L, px, py, pz);
  }
}
export function boltRestrike(L, bolt) {
  if (!L.fireTick) return;
  strikeCell(L, Math.floor(bolt.x), Math.floor(bolt.y), Math.floor(bolt.z));
}

// World.isBoundingBoxBurning (ahb.e(azt)): fire, flowing lava or still lava in any cell the
// box touches. Callers pass the box already contracted by 0.001 (Entity.moveEntity).
export const contract = (box, e = 0.001) => [box[0] + e, box[1] + e, box[2] + e, box[3] - e, box[4] - e, box[5] - e];
export function boundingBoxBurning(get, box) {
  const x1 = Math.floor(box[3] + 1), y1 = Math.floor(box[4] + 1), z1 = Math.floor(box[5] + 1);
  for (let x = Math.floor(box[0]); x < x1; x++)
    for (let y = Math.floor(box[1]); y < y1; y++)
      for (let z = Math.floor(box[2]); z < z1; z++) {
        const b = get(x, y, z);
        if (b === FIRE || b === LAVA) return true;
      }
  return false;
}
// The part of Entity.moveEntity (sa.d) after the move: in a burning box the entity takes
// dealFireDamage(1) (inFire), and unless it is wet its counter goes up by one, igniting
// (setFire(8)) when it had been put out. `fire` is this build's counter (0 = vanilla -1).
export const fireContact = (burning, wet, fire) => (burning ? { damage: 1, fire: wet ? fire : fire <= 0 ? FIRE_TICKS : fire + 1 } : { damage: 0, fire });
// The fire part of an entity's box test: only the fire block (lava keeps its own rules in
// fluids.js, which also set fire for 15 s).
export const touchesFire = (world, box) => {
  const e = contract(box);
  for (let x = Math.floor(e[0]); x < Math.floor(e[3] + 1); x++)
    for (let y = Math.floor(e[1]); y < Math.floor(e[4] + 1); y++)
      for (let z = Math.floor(e[2]); z < Math.floor(e[5] + 1); z++) if (world.get(x, y, z) === FIRE) return true;
  return false;
};

// RenderBlocks.renderBlockFire (blm.a(alb, x, y, z)): vertices [x, y, z, u, v, layer] in
// groups of four (quads), layer 0 and 1 being fire_layer_0 and fire_layer_1. `icons` are the
// two layers' {u0, u1, v0, v1} (a whole frame by default); positions are floats as the
// Tessellator stores them. On a solid or flammable block below it is eight flame planes in
// four pairs of two sides; otherwise it clings to flammable neighbours (and to a flammable
// block above), one pair of back-to-back quads each.
const UNIT = { u0: 0, u1: 1, v0: 0, v1: 1 };
export function fireVertices(get, x, y, z, icons = [UNIT, UNIT]) {
  const out = [], cx = x + 0.5, cz = z + 0.5, H = f(y + f(1.4)),
    v = (px, py, pz, u, w, layer) => out.push([f(px), f(py), f(pz), u, w, layer]);
  const catches = (a, b, c) => encouragement(get(a, b, c)) > 0;
  let layer = 0, { u0, u1, v0, v1 } = icons[0];
  const use = (l) => ({ u0, u1, v0, v1 } = icons[(layer = l)]);
  if (solidTop(get(x, y - 1, z)) || catches(x, y - 1, z)) {
    const a = cx + 0.2, b = cx - 0.2, c = cz + 0.2, d = cz - 0.2, e = cx - 0.3, g = cx + 0.3, h = cz - 0.3, i = cz + 0.3;
    v(e, H, z + 1, u1, v0, 0); v(a, y, z + 1, u1, v1, 0); v(a, y, z, u0, v1, 0); v(e, H, z, u0, v0, 0);
    v(g, H, z, u1, v0, 0); v(b, y, z, u1, v1, 0); v(b, y, z + 1, u0, v1, 0); v(g, H, z + 1, u0, v0, 0);
    use(1);
    v(x + 1, H, i, u1, v0, 1); v(x + 1, y, d, u1, v1, 1); v(x, y, d, u0, v1, 1); v(x, H, i, u0, v0, 1);
    v(x, H, h, u1, v0, 1); v(x, y, c, u1, v1, 1); v(x + 1, y, c, u0, v1, 1); v(x + 1, H, h, u0, v0, 1);
    const a2 = cx - 0.5, b2 = cx + 0.5, c2 = cz - 0.5, d2 = cz + 0.5, e2 = cx - 0.4, g2 = cx + 0.4, h2 = cz - 0.4, i2 = cz + 0.4;
    v(e2, H, z, u0, v0, 1); v(a2, y, z, u0, v1, 1); v(a2, y, z + 1, u1, v1, 1); v(e2, H, z + 1, u1, v0, 1);
    v(g2, H, z + 1, u0, v0, 1); v(b2, y, z + 1, u0, v1, 1); v(b2, y, z, u1, v1, 1); v(g2, H, z, u1, v0, 1);
    use(0);
    v(x, H, i2, u0, v0, 0); v(x, y, d2, u0, v1, 0); v(x + 1, y, d2, u1, v1, 0); v(x + 1, H, i2, u1, v0, 0);
    v(x + 1, H, h2, u0, v0, 0); v(x + 1, y, c2, u0, v1, 0); v(x, y, c2, u1, v1, 0); v(x, H, h2, u1, v0, 0);
    return out;
  }
  const inset = f(0.2), lift = f(0.0625), Y = f(H + lift), y0 = f(y + lift);
  if (((x + y + z) & 1) === 1) use(1);
  if (((Math.trunc(x / 2) + Math.trunc(y / 2) + Math.trunc(z / 2)) & 1) === 1) [u0, u1] = [u1, u0];
  const side = layer;
  if (catches(x - 1, y, z)) {
    const px = f(x + inset);
    v(px, Y, z + 1, u1, v0, side); v(x, y0, z + 1, u1, v1, side); v(x, y0, z, u0, v1, side); v(px, Y, z, u0, v0, side);
    v(px, Y, z, u0, v0, side); v(x, y0, z, u0, v1, side); v(x, y0, z + 1, u1, v1, side); v(px, Y, z + 1, u1, v0, side);
  }
  if (catches(x + 1, y, z)) {
    const px = f(x + 1 - inset);
    v(px, Y, z, u0, v0, side); v(x + 1, y0, z, u0, v1, side); v(x + 1, y0, z + 1, u1, v1, side); v(px, Y, z + 1, u1, v0, side);
    v(px, Y, z + 1, u1, v0, side); v(x + 1, y0, z + 1, u1, v1, side); v(x + 1, y0, z, u0, v1, side); v(px, Y, z, u0, v0, side);
  }
  if (catches(x, y, z - 1)) {
    const pz = f(z + inset);
    v(x, Y, pz, u1, v0, side); v(x, y0, z, u1, v1, side); v(x + 1, y0, z, u0, v1, side); v(x + 1, Y, pz, u0, v0, side);
    v(x + 1, Y, pz, u0, v0, side); v(x + 1, y0, z, u0, v1, side); v(x, y0, z, u1, v1, side); v(x, Y, pz, u1, v0, side);
  }
  if (catches(x, y, z + 1)) {
    const pz = f(z + 1 - inset);
    v(x + 1, Y, pz, u0, v0, side); v(x + 1, y0, z + 1, u0, v1, side); v(x, y0, z + 1, u1, v1, side); v(x, Y, pz, u1, v0, side);
    v(x, Y, pz, u1, v0, side); v(x, y0, z + 1, u1, v1, side); v(x + 1, y0, z + 1, u0, v1, side); v(x + 1, Y, pz, u0, v0, side);
  }
  if (catches(x, y + 1, z)) {
    const a = cx + 0.5, b = cx - 0.5, c = cz + 0.5, d = cz - 0.5, top = y + 1, T = f(top + f(-0.2));
    use(0);
    if (((x + top + z) & 1) === 0) {
      v(b, T, z, u1, v0, 0); v(a, top, z, u1, v1, 0); v(a, top, z + 1, u0, v1, 0); v(b, T, z + 1, u0, v0, 0);
      use(1);
      v(a, T, z + 1, u1, v0, 1); v(b, top, z + 1, u1, v1, 1); v(b, top, z, u0, v1, 1); v(a, T, z, u0, v0, 1);
    } else {
      v(x, T, c, u1, v0, 0); v(x, top, d, u1, v1, 0); v(x + 1, top, d, u0, v1, 0); v(x + 1, T, c, u0, v0, 0);
      use(1);
      v(x + 1, T, d, u1, v0, 1); v(x + 1, top, c, u1, v1, 1); v(x, top, c, u0, v1, 1); v(x, T, d, u0, v0, 1);
    }
  }
  return out;
}

// A binary heap of scheduled ticks ordered like NextTickListEntry.compareTo: time, then
// creation order (fluids.js keeps its own copy of the same thing).
const before = (a, b) => a.time < b.time || (a.time === b.time && a.id < b.id);
class TickQueue {
  constructor() {
    this.heap = [];
    this.pending = new Map();
    this.serial = 0;
  }
  // World.scheduleBlockUpdate: one entry per position; a second request keeps the first's time.
  add(key, entry) {
    if (this.pending.has(key)) return;
    entry.id = this.serial++;
    entry.key = key;
    this.pending.set(key, entry);
    const h = this.heap;
    let i = h.push(entry) - 1;
    while (i > 0 && before(h[i], h[(i - 1) >> 1])) {
      [h[i], h[(i - 1) >> 1]] = [h[(i - 1) >> 1], h[i]];
      i = (i - 1) >> 1;
    }
  }
  due(time) {
    return this.heap.length > 0 && this.heap[0].time <= time;
  }
  pop() {
    const h = this.heap, top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      for (let i = 0; ; ) {
        let m = i;
        for (const c of [2 * i + 1, 2 * i + 2]) if (c < h.length && before(h[c], h[m])) m = c;
        if (m === i) break;
        [h[i], h[m]] = [h[m], h[i]];
        i = m;
      }
    }
    this.pending.delete(top.key);
    return top;
  }
}

// Fire in a running world. `weather` is a function returning the current Weather
// (World.rand, updateLCG and isRaining live there); `stillLava(x, y, z)` says whether a
// lava cell is BlockStaticLiquid (no fluid tick pending), the only kind that ticks randomly.
export const MAX_TICKS = 1000;
// Blocks of this build whose Block.setTickRandomly is true (grass, leaves, farmland, wheat,
// tall grass and flowers (BlockBush), lava, fire); they decide which sections are drawn for.
const RANDOM_TICKS = new Uint8Array(256);
for (const b of [1, 5, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 43, 44, LAVA, FIRE]) RANDOM_TICKS[b] = 1;
export class Fire {
  constructor(world, { weather, stillLava = () => true, difficulty = DIFFICULTY, fireTick = true } = {}) {
    this.world = world;
    this.weather = weather;
    this.stillLava = stillLava;
    this.queue = new TickQueue();
    this.time = 0;
    this.changes = [];
    const self = this;
    // The level adapter. Its edits go through World.set so every onChange hook (fluids,
    // flowers, this class's own) sees them, and are remembered for the renderer.
    this.L = {
      get: (x, y, z) => world.get(x, y, z),
      meta: (x, y, z) => world.getMeta(x, y, z),
      setBlock(x, y, z, b, meta = 0) {
        const old = world.get(x, y, z);
        if (world.set(x, y, z, b, true, meta)) self.changes.push([x, y, z, old, b]);
      },
      setAir(x, y, z) {
        const old = world.get(x, y, z);
        if (old !== 0 && world.set(x, y, z, 0)) self.changes.push([x, y, z, old, 0]);
      },
      // flag 4: no notification and no re-render; fire's age is not drawn.
      setMeta(x, y, z, meta) {
        const b = world.get(x, y, z);
        if (b !== 0) world.put(x, y, z, b, meta);
      },
      schedule: (x, y, z, delay) => self.schedule(x, y, z, delay),
      raining: () => self.weather().isRaining(),
      strike: (x, y, z) => canLightningStrikeAt(self.weather(), world, x, y, z),
      // isBlockHighHumidity (BiomeGenBase rainfall > 0.85): the plains, hills and island
      // presets of this build are all drier than that.
      humid: () => false,
      get rand() {
        return self.weather().random;
      },
      difficulty,
      fireTick,
    };
  }
  key(x, y, z) {
    return this.world.index(x, y, z);
  }
  schedule(x, y, z, delay = 30) {
    if (this.world.inside(x, y, z)) this.queue.add(this.key(x, y, z), { x, y, z, time: this.time + delay });
  }
  // Wraps world.onChange (fluids.js installed it first, like watchFlowers in main.js):
  // World.setBlock's onBlockAdded for a new fire, then onNeighborBlockChange for the
  // fires around the cell.
  watch() {
    const next = this.world.onChange;
    this.world.onChange = (x, y, z, old, now) => {
      next?.(x, y, z, old, now);
      if (now === FIRE && old !== FIRE) {
        this.mark(x, y, z);
        blockAdded(this.L, x, y, z);
      }
      for (const [dx, dy, dz] of SIDES) if (this.world.get(x + dx, y + dy, z + dz) === FIRE) neighborChange(this.L, x + dx, y + dy, z + dz);
    };
  }
  // Saves keep no scheduled ticks (the original saves TileTicks): every saved fire gets one
  // after 30 to 39 ticks.
  wake() {
    for (const [key, v] of this.world.edits) {
      if ((v & 255) !== FIRE) continue;
      const [x, y, z] = key.split(",").map(Number);
      this.schedule(x, y, z, 30 + this.L.rand.nextInt(10));
    }
  }
  // ItemFlintAndSteel.onItemUse's setBlock(x, y, z, fire) on an air cell.
  ignite(x, y, z) {
    if (this.world.get(x, y, z) !== 0) return false;
    this.L.setBlock(x, y, z, FIRE, 0);
    return true;
  }
  // World.extinguishFire (ahb.a(yz, x, y, z, side) after the offset): fire at the cell goes.
  extinguish(x, y, z) {
    if (this.world.get(x, y, z) !== FIRE) return false;
    this.L.setAir(x, y, z);
    return true;
  }
  // The bolt's fire hook for Weather: see LightningBolt in weather.js.
  get strikes() {
    return { start: (bolt) => boltStart(this.L, bolt), restrike: (bolt) => boltRestrike(this.L, bolt) };
  }
  // The sections WorldServer.func_147456_g draws for: ExtendedBlockStorage.getNeedsRandomTick,
  // true when a block that ticks randomly is in the 16x16x16 section. Rescanned every second
  // (and a new fire marks its section at once), so the draw count per tick varies with the
  // world like the original's: a fixed count that is a multiple of 128 would pin every
  // slot's x to one value, because the generator's low bits cycle that fast.
  scan() {
    const w = this.world, n = SIZE / 16, secs = HEIGHT / 16, marks = new Uint8Array(n * n * secs);
    for (let x = 0; x < SIZE; x++)
      for (let z = 0; z < SIZE; z++) {
        const base = (x >> 4) * n * secs + (z >> 4) * secs, col = w.index(x, 0, z);
        for (let y = 0; y < HEIGHT; y++) if (RANDOM_TICKS[w.data[col + y]]) marks[base + (y >> 4)] = 1;
      }
    this.marks = marks;
  }
  mark(x, y, z) {
    if (this.marks) this.marks[(x >> 4) * (SIZE / 16) * (HEIGHT / 16) + (z >> 4) * (HEIGHT / 16) + (y >> 4)] = 1;
  }
  // WorldServer.tickUpdates for fire, then the random block ticks (func_147456_g): per
  // active chunk and 16-high section that needs them, three cells chosen from
  // World.updateLCG (3 * lcg + 1013904223, x = k & 15, z = (k >> 8) & 15, y = (k >> 16) & 15 of
  // lcg >> 2). Fire and static lava are the blocks here that this class ticks. Returns the
  // cells changed as [x, y, z, old, new].
  tick(px = SIZE / 2, pz = SIZE / 2) {
    this.time++;
    const w = this.world, n = SIZE / 16, secs = HEIGHT / 16;
    if (!this.marks || this.time % 20 === 1) this.scan();
    for (let m = MAX_TICKS; m > 0 && this.queue.due(this.time); m--) {
      const { x, y, z } = this.queue.pop();
      if (w.get(x, y, z) === FIRE) updateTick(this.L, x, y, z);
    }
    const weather = this.weather();
    for (const [cx, cz] of Weather.activeChunks(px, pz))
      for (let section = 0; section < secs; section++) {
        if (!this.marks[cx * n * secs + cz * secs + section]) continue;
        for (let i = 0; i < 3; i++) {
          weather.lcg = (Math.imul(weather.lcg, 3) + 1013904223) | 0;
          const k = weather.lcg >> 2, x = cx * 16 + (k & 15), z = cz * 16 + ((k >> 8) & 15), y = section * 16 + ((k >> 16) & 15), b = w.get(x, y, z);
          if (b === FIRE) updateTick(this.L, x, y, z);
          else if (b === LAVA && this.stillLava(x, y, z)) lavaTick(this.L, x, y, z);
        }
      }
    const changes = this.changes;
    this.changes = [];
    return changes;
  }
  // Changes made outside tick() (flint and steel, a hook): drained like tick()'s.
  drain() {
    const changes = this.changes;
    this.changes = [];
    return changes;
  }
  // BlockFire.randomDisplayTick's sound: WorldClient samples 1000 cells within 15 blocks
  // of the viewer per tick (rand.nextInt(16) - rand.nextInt(16) on each axis); a fire cell
  // crackles one time in 24, "fire.fire" at volume 1 + rand and pitch 0.3 + 0.7 * rand.
  // Calls `play(x, y, z, volume, pitch)`. The original uses an unseeded Random.
  ambient(px, py, pz, play, random = Math.random) {
    const n = (m) => Math.floor(random() * m), w = this.world, x0 = Math.floor(px), y0 = Math.floor(py), z0 = Math.floor(pz);
    for (let i = 0; i < 1000; i++) {
      const x = x0 + n(16) - n(16), y = y0 + n(16) - n(16), z = z0 + n(16) - n(16);
      if (w.get(x, y, z) === FIRE && n(24) === 0) play(x + 0.5, y + 0.5, z + 0.5, f(1 + f(random())), f(f(f(random()) * f(0.7)) + f(0.3)));
    }
  }
}

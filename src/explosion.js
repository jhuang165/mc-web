// Explosion (agw), EntityTNTPrimed (xw) and the explosion side of BlockTNT (aob)
// from Minecraft Java 1.7.10. Rules come from the original bytecode; the replays
// in explosion.test.js compare them with public/research/creeper-reference.json
// (tools/verify-creepers.mjs). Notes: public/research/creepers.md.
import { JavaRandom } from "./lighting.js";
import { rayTraceBlocks } from "./projectiles.js";
import { moveEntity } from "./entities.js";
import { STAIRS, stairExplosionResistance } from "./stairs.js";
import { DISPENSER, STICKY_PISTON, PISTON, PISTON_HEAD, DISPENSER_ITEM, STICKY_PISTON_ITEM, PISTON_ITEM } from "./dispenser-piston.js";
import { STONE_BRICKS, DOUBLE_STONE_SLAB, STONE_SLAB, END_PORTAL_FRAME, CAULDRON, FLOWER_POT, ITEM_STONE_BRICKS, ITEM_CAULDRON, ITEM_FLOWER_POT, slabItem } from "./stone-utility.js";
import { TNT, WOOL, RED_FLOWER, SAPLING, SNOW_LAYER, ICE, FIRE, CARROTS, POTATOES, WEB, LADDER, YELLOW_FLOWER, ENCHANTING_TABLE, WOODEN_DOOR, IRON_DOOR, IRON_BARS, GLASS_PANE } from "./world.js";
import { leafDrops } from "./trees.js";
import { SHAPED_RESISTANCE } from "./shaped-blocks.js";
import { CHEST_RESISTANCE } from "./chest-blocks.js";
import { BLAST_RESISTANCE2, itemOfBlock2, ITEM_GLOWSTONE_DUST, GLOWSTONE } from "./redstone-blocks-2.js";

const f = Math.fround;

// Block.getExplosionResistance(null) = blockResistance / 5 (setHardness sets the resistance
// to hardness * 5 unless setResistance gives resistance * 3), per internal block id, read
// from the probe's block records. Air is skipped by the ray (material air).
const RESIST = {
  1: 0.6, 2: 0.5, 3: 6, 4: 2, 5: 0.2, 6: 0.5, 7: 3, 8: 6, 9: 0.3, 10: 100, 11: 3600000, 12: 6, 13: 2.5, 14: 3.5,
  15: 3, 16: 3, 17: 3, 18: 3, 19: 0.8, 20: 0, 21: 1.5, 22: 1200, 23: 0.2, 24: 0.6, 25: 0.6, 26: 6, 27: 6, 28: 6,
  29: 0.6, 30: 0.6, 39: 0, 40: 4.2, 41: 2.5, 42: 100, 43: 0, 44: 0, 45: 0, 46: 0.1, 47: 0.5, 48: 0, 49: 0, 50: 0,
  51: 4, 52: 0.4, [TNT]: 0, [ENCHANTING_TABLE]: 1200, // BlockEnchantmentTable: setResistance(2000), see enchanting-table-reference.json
};
for (let id = 31; id <= 38; id++) RESIST[id] = 0;
// BlockDoor, BlockPane getExplosionResistance (doors-panes-reference.json facts): wooden door 3, iron door 5, iron bars 6, glass pane 0.3.
RESIST[WOODEN_DOOR] = 3; RESIST[IRON_DOOR] = 5; RESIST[IRON_BARS] = 6; RESIST[GLASS_PANE] = 0.3;
RESIST[139] = 3600000; // BlockCommandBlock: setResistance(6000000), aji.p registration
RESIST[171] = 45 / 5; // BlockDragonEgg: setHardness(3) setResistance(15) -> 45 / 5 (end-reference.json facts)
RESIST[173] = 3; // BlockBeacon setResistance(15) / 5 (pyramid.js)
RESIST[149] = 1200000; // BlockEndPortal setResistance(6000000) / 5 (eye-of-ender.js)
for (const [id, r] of Object.entries(CHEST_RESISTANCE)) RESIST[id] = r; // chest-blocks.js (trapped chest, ender chest)
for (const [id, r] of Object.entries(SHAPED_RESISTANCE)) RESIST[id] = r; // shaped-blocks.js (wood slabs, gate and trapdoor, cobblestone wall)
RESIST[138] = 0.2; // BlockBed (bed-reference.json facts)
RESIST[159] = RESIST[160] = 0; RESIST[161] = 0.5; // BlockStem, BlockCake (hardness 0.5; stems-cake.js)
// Colored blocks (colored-blocks-reference.json explosionResistance): stained glass 0.3, pane 0.3, carpet 0.1, hay 0.5, coal 6, lapis 3, emerald 6, sponge 0.6, jack o'lantern 1.
Object.assign(RESIST, { 140: 0.3, 141: 0.3, 142: 0.1, 143: 0.5, 144: 6, 145: 3, 146: 6, 147: 0.6, 148: 1 });
// BlockStairs.getExplosionResistance: the model block's resistance / 5 (stairs-reference.json).
for (const id of Object.keys(STAIRS)) RESIST[id] = stairExplosionResistance(Number(id));
// Stone bricks, both slab blocks (resistance field 30 / 5), the end portal frame (setResistance(6000000) -> 3600000), the cauldron (2) and the pot (0): stone-utility-reference.json.
for (let id = 107; id <= 114; id++) RESIST[id] = id >= 108 && id <= 111 ? 0.5 : 0; // redstone components: native resistance 2.5 for lever, plates and button, else 0
RESIST[STONE_BRICKS] = RESIST[DOUBLE_STONE_SLAB] = RESIST[STONE_SLAB] = 6; RESIST[82] = 6; RESIST[END_PORTAL_FRAME] = 3600000; RESIST[CAULDRON] = 2; RESIST[FLOWER_POT] = 0;
// BlockDispenser (hardness 3.5), BlockPistonBase and BlockPistonExtension (hardness 0.5): dispenser-piston-reference.json.
for (const [id, r] of Object.entries(BLAST_RESISTANCE2)) RESIST[id] = r; // redstone torches, lamps, block, button, plates, comparators, sensor, moving piston, glowstone (redstone-blocks-2-reference.json)
RESIST[133] = 4.8; // BlockHopper: setResistance(8) (field 24) / 5 (hopper-reference.json)
RESIST[DISPENSER] = RESIST[132] = 3.5; RESIST[STICKY_PISTON] = RESIST[PISTON] = RESIST[PISTON_HEAD] = 0.5;
export const explosionResistance = (id) => f(RESIST[id] ?? 0);

// java.util.HashSet<ChunkPosition> (a Java 8 HashMap): ChunkPosition.hashCode is
// x * 8976890 + y * 981131 + z, HashMap.hash spreads it with h ^ (h >>> 16), buckets
// keep insertion order, tables start at 16 and double past a 0.75 load factor (split
// bins keep their relative order). Explosion.affectedBlockPositions is
// ArrayList.addAll(set), so its order is this iteration order. A bin that would
// reach 9 entries in a table of 64 or more becomes a TreeNode bin in Java, whose
// order is not modelled; `treeified` reports it (never seen in the probe cases).
export class PositionSet {
  constructor() {
    this.table = null;
    this.size = 0;
    this.threshold = 0;
    this.treeified = false;
  }
  static hash(x, y, z) {
    const h = (Math.imul(x, 8976890) + Math.imul(y, 981131) + z) | 0;
    return h ^ (h >>> 16);
  }
  resize() {
    const old = this.table, oldCap = old ? old.length : 0, cap = oldCap ? oldCap * 2 : 16;
    this.threshold = oldCap ? this.threshold * 2 : 12;
    const table = new Array(cap).fill(null);
    if (old)
      for (let j = 0; j < oldCap; j++) {
        const bin = old[j];
        if (!bin) continue;
        const lo = [], hi = [];
        for (const e of bin) (e.h & oldCap ? hi : lo).push(e);
        if (lo.length) table[j] = lo;
        if (hi.length) table[j + oldCap] = hi;
      }
    this.table = table;
  }
  add(x, y, z) {
    if (!this.table) this.resize();
    const h = PositionSet.hash(x, y, z), i = h & (this.table.length - 1), bin = this.table[i];
    if (!bin) this.table[i] = [{ h, x, y, z }];
    else {
      for (const e of bin) if (e.h === h && e.x === x && e.y === y && e.z === z) return false;
      bin.push({ h, x, y, z });
      // putVal: binCount >= TREEIFY_THRESHOLD - 1 -> treeifyBin, which only resizes below 64.
      if (bin.length >= 9) {
        if (this.table.length < 64) this.resize();
        else this.treeified = true;
      }
    }
    if (++this.size > this.threshold) this.resize();
    return true;
  }
  list() {
    const out = [];
    if (this.table) for (const bin of this.table) if (bin) for (const e of bin) out.push([e.x, e.y, e.z]);
    return out;
  }
}

const RAY_STEP = f(0.3), RAY_DECAY = f(f(0.3) * f(0.75)), RAY_STEP_D = RAY_STEP;
// Explosion.doExplosionA, block half: 16^3 grid of rays from the surface of the cube,
// each starting with strength size * (0.7 + world.rand.nextFloat() * 0.6) and losing
// (resistance + 0.3) * 0.3 per non-air cell and 0.225 per 0.3 step; every cell (air
// included) visited while the strength is positive joins the set. Returns the affected
// positions in ArrayList order. `world.get(x, y, z)` gives internal block ids.
export function explosionBlocks(world, x, y, z, size, rand, resistance = explosionResistance) {
  const set = new PositionSet(), n = 16, last = f(n - 1);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) {
        if (i !== 0 && i !== n - 1 && j !== 0 && j !== n - 1 && k !== 0 && k !== n - 1) continue;
        let dx = f(f(f(i / last) * 2) - 1), dy = f(f(f(j / last) * 2) - 1), dz = f(f(f(k / last) * 2) - 1);
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        dx /= len; dy /= len; dz /= len;
        let strength = f(size * f(f(0.7) + f(rand.nextFloat() * f(0.6))));
        let px = x, py = y, pz = z;
        while (strength > 0) {
          const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz), id = world.get(bx, by, bz);
          if (id !== 0) strength = f(strength - f(f(resistance(id) + RAY_STEP) * RAY_STEP));
          if (strength > 0) set.add(bx, by, bz);
          px += dx * RAY_STEP_D;
          py += dy * RAY_STEP_D;
          pz += dz * RAY_STEP_D;
          strength = f(strength - RAY_DECAY);
        }
      }
  const list = set.list();
  list.treeified = set.treeified;
  return list;
}

// World.getBlockDensity (ahb.a(Vec3, AxisAlignedBB)): the share of sample points of
// `box` ([x0, y0, z0, x1, y1, z1]) with a clear World.rayTraceBlocks line to `vec`.
// The loop counters are floats advanced by the double step 1 / (extent * 2 + 1).
export function blockDensity(world, vec, box) {
  const sx = 1 / ((box[3] - box[0]) * 2 + 1), sy = 1 / ((box[4] - box[1]) * 2 + 1), sz = 1 / ((box[5] - box[2]) * 2 + 1);
  if (!(sx >= 0 && sy >= 0 && sz >= 0)) return 0;
  let clear = 0, total = 0;
  for (let a = 0; a <= 1; a = f(a + sx))
    for (let b = 0; b <= 1; b = f(b + sy))
      for (let c = 0; c <= 1; c = f(c + sz)) {
        const p = [box[0] + (box[3] - box[0]) * a, box[1] + (box[4] - box[1]) * b, box[2] + (box[5] - box[2]) * c];
        if (!rayTraceBlocks(world, p, vec)) clear++;
        total++;
      }
  return f(f(clear) / f(total));
}

// Explosion.doExplosionA, entity half, for one entity: within 2 * size of the centre
// (Entity.getDistance, a float, / (size * 2) <= 1) it takes
// (int)((impact^2 + impact) / 2 * 8 * (size * 2) + 1) damage, impact = (1 - distance) * density,
// and gains impact times the unit vector from the centre to its eyes
// (posY + getEyeHeight). EnchantmentProtection.func_92092_a (Blast Protection) is
// not modelled, so the push uses impact unchanged. `box` is the entity's
// bounding box, `eye` its posY + eye height. Returns null when out of range.
export function explosionImpact(world, cx, cy, cz, size, posX, posY, posZ, eye, box) {
  const radius = f(size * 2);
  // Entity.getDistance returns MathHelper.sqrt_double, a float.
  const dist = f(Math.sqrt((posX - cx) ** 2 + (posY - cy) ** 2 + (posZ - cz) ** 2)) / radius;
  if (!(dist <= 1)) return null;
  let dx = posX - cx, dy = eye - cy, dz = posZ - cz;
  const len = f(Math.sqrt(dx * dx + dy * dy + dz * dz));
  if (len === 0) return null;
  dx /= len; dy /= len; dz /= len;
  const density = blockDensity(world, [cx, cy, cz], box), impact = (1 - dist) * density;
  const damage = Math.trunc(((impact * impact + impact) / 2) * 8 * radius + 1);
  return { damage, density, impact, push: [dx * impact, dy * impact, dz * impact] };
}

// Block.dropBlockAsItem_do (func_149642_a) position: three world.rand floats,
// (double)(rand * 0.7F) + (double)(1 - 0.7F) * 0.5 inside the block.
const SPREAD = f(0.7), INSET = f(1 - SPREAD) * 0.5;
const at = (rand, x, y, z) => [x + f(rand.nextFloat() * SPREAD) + INSET, y + f(rand.nextFloat() * SPREAD) + INSET, z + f(rand.nextFloat() * SPREAD) + INSET];
// EntityXPOrb.getXPSplit
const XP_SPLITS = [2477, 1237, 617, 307, 149, 73, 37, 17, 7, 3, 1];
export const xpSplit = (n) => XP_SPLITS.find((v) => n >= v) ?? 1;

const APPLE = 200, SEEDS = 309, WHEAT = 305, FLINT = 313, BOOK = 314, CLAY_BALL = 307, SNOWBALL = 312, STRING = 321,
  COAL = 301, DIAMOND = 303, CARROT = 322, POTATO = 323, POISONOUS_POTATO = 325;
const isWheat = (id) => id >= 31 && id <= 38;
// getItemDropped (and damageDropped) per internal id, after the nextFloat chance:
// [item, damage] or null. Consumes world.rand where the original does.
function itemDropped(id, meta, rand) {
  if (id === 39) return rand.nextInt(8) === 0 ? [SEEDS, 0] : null; // BlockTallGrass
  if (id === 25) return rand.nextInt(10) === 0 ? [FLINT, 0] : [25, 0]; // BlockGravel
  if (isWheat(id)) return id === 38 ? [WHEAT, 0] : [SEEDS, 0];
  if (id === CARROTS) return [CARROT, 0];
  if (id === POTATOES) return [POTATO, 0];
  switch (id) {
    case 1: case 29: case 30: return [2, 0]; // grass, farmland -> dirt
    case 3: return [12, 0]; // stone -> cobblestone
    case 15: return [COAL, 0];
    case 17: return [DIAMOND, 0];
    case 21: return [BOOK, 0];
    case 24: return [CLAY_BALL, 0];
    case 23: return [SNOWBALL, 0];
    case WEB: return [STRING, 0];
    case WOOL: case RED_FLOWER: return [id, meta];
    // BlockDoor.getItemDropped: the lower half's door item (original 324 and 330), nothing for the upper half; BlockPane (glass) drops nothing.
    case WOODEN_DOOR: return meta & 8 ? null : [470, 0];
    case IRON_DOOR: return meta & 8 ? null : [471, 0];
    case GLASS_PANE: return null;
    // BlockStoneBrick drops its metadata, BlockSlab its type (the sandstone slab keeps item 82), the frame nothing; the cauldron and pot their items.
    case STONE_BRICKS: return [ITEM_STONE_BRICKS, meta];
    case DOUBLE_STONE_SLAB: case STONE_SLAB: { const s = slabItem(meta & 7); return [s.id, s.damage]; }
    case END_PORTAL_FRAME: return null;
    case CAULDRON: return [ITEM_CAULDRON, 0];
    case FLOWER_POT: return [ITEM_FLOWER_POT, 0];
    // The dispenser and both bases drop their own items; the head (getItemDropped null) nothing.
    case 133: return [1133, 0]; // the hopper item (the contents spill from the tile)
    case DISPENSER: return [DISPENSER_ITEM, 0];
    case 132: return [1132, 0]; // the dropper item (the contents spill from the tile)
    case STICKY_PISTON: return [STICKY_PISTON_ITEM, 0];
    case PISTON: return [PISTON_ITEM, 0];
    case PISTON_HEAD: return null;
    // Redstone blocks 119-131: the block items sit at 1000 + id (the unlit torch drops the lit one, the lit lamp the unlit lamp, the comparators item 381); glowstone dust; the moving piston nothing.
    case 119: case 120: case 121: case 122: case 123: case 124: case 125: case 126: case 127: case 128: case 129: return [itemOfBlock2(id), 0];
    case GLOWSTONE: return [ITEM_GLOWSTONE_DUST, 0];
    // Shaped blocks (shaped-blocks.js): slabs by wood type (the double slab twice), gate and trapdoor themselves, the wall by damage.
    case 165: case 166: return [1165, meta & 7];
    case 167: case 168: return [1000 + id, 0];
    case 169: return [1169, meta & 15];
    case 130: return null;
    default: return [id, 0];
  }
}
// Block.quantityDropped(Random) / quantityDroppedWithBonus(0, Random).
function quantity(id, rand) {
  if (id === 39) return 1 + rand.nextInt(1);
  if (id === 9 || id === ICE || id === FIRE || id === SNOW_LAYER || id === 10 || id === 42) return 0;
  if (id === 21) return 3;
  if (id === 24 || id === 23) return 4;
  if (id === DOUBLE_STONE_SLAB || id === 166) return 2; // BlockSlab.quantityDropped
  if (id === GLOWSTONE) return Math.min(4, 2 + rand.nextInt(3) + rand.nextInt(1)); // BlockGlowstone.quantityDroppedWithBonus(0): quantityDropped 2 + nextInt(3), then the Fortune roll
  return 1;
}
// Block.dropBlockAsItemWithChance(world, x, y, z, meta, chance, 0) as each block of this
// build overrides it, with every stack an EntityItem of one at a dropBlockAsItem position:
// BlockLeaves ignores the chance (sapling 1/20, oak apple 1/200), BlockCrops adds three
// nextInt(15) <= age seed rolls when fully grown (carrots/potatoes their crop, potatoes a
// 1/50 poisonous potato), BlockOre drops XP (coal 0-2, diamond 3-7) whatever the roll.
// Returns { items: [{ id, damage, x, y, z }], xp: [orb values] } using `rand` (world.rand).
export function explosionDrops(id, meta, x, y, z, chance, rand) {
  const items = [], xp = [];
  const drop = (item, damage) => {
    const [px, py, pz] = at(rand, x, y, z);
    items.push({ id: item, damage, x: px, y: py, z: pz });
  };
  if (id === 5) {
    // trees.leafDrops already consumes the three position floats; re-derive them here
    // by replaying with a recording random.
    const rec = { nextInt: (n) => rand.nextInt(n), nextFloat: () => rand.nextFloat() }, out = [];
    const positions = [];
    rec.nextFloat = () => { const v = rand.nextFloat(); positions.push(v); return v; };
    for (const d of leafDrops(rec, meta)) out.push(d);
    out.forEach((d, i) => {
      const [a, b, c] = positions.slice(i * 3, i * 3 + 3);
      items.push({ id: d.id, damage: d.damage, x: x + f(a * SPREAD) + INSET, y: y + f(b * SPREAD) + INSET, z: z + f(c * SPREAD) + INSET });
    });
    return { items, xp };
  }
  const n = quantity(id, rand);
  for (let i = 0; i < n; i++) {
    if (rand.nextFloat() <= chance) {
      const item = itemDropped(id, meta, rand);
      if (item) drop(item[0], item[1]);
    }
  }
  const age = isWheat(id) ? id - 31 : id === CARROTS || id === POTATOES ? meta : -1;
  if (age >= 7) {
    const seed = isWheat(id) ? SEEDS : id === CARROTS ? CARROT : POTATO;
    for (let i = 0; i < 3; i++) if (rand.nextInt(15) <= age) drop(seed, 0);
    if (id === POTATOES && rand.nextInt(50) === 0) drop(POISONOUS_POTATO, 0);
  }
  if (id === 15 || id === 17) {
    // MathHelper.getRandomIntegerInRange(rand, 0, 2) / (rand, 3, 7), then dropXpOnBlockBreak.
    let total = id === 15 ? rand.nextInt(3) : rand.nextInt(5) + 3;
    while (total > 0) {
      const v = xpSplit(total);
      total -= v;
      xp.push(v);
    }
  }
  return { items, xp };
}

// BlockTNT.onBlockDestroyedByExplosion (aob.a(World, x, y, z, Explosion)): a primed TNT
// at the block centre with fuse world.rand.nextInt(80 / 4) + 80 / 8.
export const chainFuse = (rand) => rand.nextInt(20) + 10;

// Explosion.doExplosionB(false) sound: random.explode, volume 4,
// pitch (1 + (rand - rand) * 0.2) * 0.7 from world.rand.
export const explodePitch = (rand) => f(f(1 + f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2))) * f(0.7));

// One whole Explosion on a block world: doExplosionA's rays (entities are the
// caller's), then doExplosionB(false): the sound pitch, then for each listed position
// whose block is not air: drops at chance 1 / size unless it is TNT
// (canDropFromExplosion false), removal, and TNT priming. `flaming` (Ghast fireballs;
// creepers and TNT never set it) then puts fire on a third of the air cells above an
// opaque cube, from the explosion's own Random. Returns
// { list, pitch, broken: [{x, y, z, id, meta}], drops, xp, primed: [{x, y, z, fuse}], fires }.
// The caller performs the block edits; `world.get/getMeta` are read only.
export function explodeBlocks(world, x, y, z, size, rand, { smoking = true, flaming = false, own = new JavaRandom(Date.now()), opaque = () => false, resistance = explosionResistance } = {}) {
  const list = explosionBlocks(world, x, y, z, size, rand, resistance);
  const pitch = explodePitch(rand), broken = [], drops = [], xp = [], primed = [], fires = [];
  const removed = new Set(), get = (bx, by, bz) => (removed.has(bx + "," + by + "," + bz) ? 0 : world.get(bx, by, bz));
  const chance = f(1 / size);
  if (smoking)
    for (const [bx, by, bz] of list) {
      const id = get(bx, by, bz);
      if (id === 0) continue;
      const meta = world.getMeta ? world.getMeta(bx, by, bz) : 0;
      if (id !== TNT) {
        const d = explosionDrops(id, meta, bx, by, bz, chance, rand);
        drops.push(...d.items);
        for (const v of d.xp) xp.push({ value: v, x: bx + 0.5, y: by + 0.5, z: bz + 0.5 });
      }
      removed.add(bx + "," + by + "," + bz);
      broken.push({ x: bx, y: by, z: bz, id, meta });
      if (id === TNT) primed.push({ x: f(bx + 0.5), y: f(by + 0.5), z: f(bz + 0.5), fuse: chainFuse(rand) });
    }
  if (flaming)
    for (const [bx, by, bz] of list)
      if (get(bx, by, bz) === 0 && opaque(get(bx, by - 1, bz)) && own.nextInt(3) === 0) fires.push([bx, by, bz]);
  return { list, pitch, broken, drops, xp, primed, fires };
}

// --- EntityTNTPrimed (xw) ---
export const TNT_SIZE = f(0.98), TNT_Y_OFFSET = f(TNT_SIZE / 2), TNT_FUSE = 80, TNT_POWER = 4;
// EntityTNTPrimed(world, x, y, z, placer): posY is the box centre (yOffset = height / 2); the
// stored y is the box bottom. Motion: a Math.random heading at 0.02 and 0.2 up.
export function primeTnt(x, posY, z, { fuse = TNT_FUSE, placer = null, random = Math.random } = {}) {
  const a = f(random() * Math.PI * 2);
  const y = posY - TNT_Y_OFFSET, half = TNT_SIZE / 2;
  return {
    x, y, z, px: x, py: y, pz: z,
    bb: [x - half, y, z - half, x + half, y + TNT_SIZE, z + half],
    vx: f(-f(Math.sin(a)) * f(0.02)), vy: 0.20000000298023224, vz: f(-f(Math.cos(a)) * f(0.02)),
    fuse, placer, onGround: false, collidedH: false, fallDistance: 0,
  };
}
// Explosion.doExplosionA applies knockback to other primed TNT even though damage is ignored.
// posY includes yOffset; EntityTNTPrimed inherits Entity.getEyeHeight = 0.
export function explodeTnt(world, e, x, y, z, size) {
  const posY = e.y + TNT_Y_OFFSET, half = TNT_SIZE / 2;
  const hit = explosionImpact(world, x, y, z, size, e.x, posY, e.z, posY,
    [e.x - half, e.y, e.z - half, e.x + half, e.y + TNT_SIZE, e.z + half]);
  if (hit) { e.vx += hit.push[0]; e.vy += hit.push[1]; e.vz += hit.push[2]; }
}
// EntityTNTPrimed.onUpdate (xw.h): gravity 0.04, Entity.moveEntity (stepHeight 0),
// drag 0.98, ground friction 0.7 and a -0.5 bounce; `if (fuse-- <= 0)` explodes at
// posY (the box centre) with strength 4. Returns the explosion centre or null.
export function tickTnt(world, e, smoke = null) {
  e.px = e.x; e.py = e.y; e.pz = e.z;
  e.vy -= 0.03999999910593033;
  moveEntity(world, e, TNT_SIZE, TNT_SIZE, e.vx, e.vy, e.vz, 0);
  e.vx *= 0.9800000190734863;
  e.vy *= 0.9800000190734863;
  e.vz *= 0.9800000190734863;
  if (e.onGround) {
    e.vx *= 0.699999988079071;
    e.vz *= 0.699999988079071;
    e.vy *= -0.5;
  }
  if (e.fuse-- <= 0) return { x: e.x, y: e.y + TNT_Y_OFFSET, z: e.z };
  smoke?.(e.x, e.y + TNT_Y_OFFSET + 0.5, e.z);
  return null;
}
// RenderTNTPrimed (boy.a(xw, ...)): in the last 10 ticks the block swells by up to 30%
// (f = 1 - (fuse - partial + 1) / 10 clamped, f^4 * 0.3), and every other 5-tick period
// a white copy is drawn over it with alpha (1 - (fuse - partial + 1) / 100) * 0.8.
export function tntRender(fuse, partial) {
  const left = fuse - partial + 1;
  let scale = 1;
  if (left < 10) {
    let k = Math.min(1, Math.max(0, 1 - left / 10));
    k *= k;
    k *= k;
    scale = 1 + k * 0.3;
  }
  const flash = Math.floor(fuse / 5) % 2 === 0 ? (1 - left / 100) * 0.8 : 0;
  return { scale, flash };
}

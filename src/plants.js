// Sugar cane and cactus, Minecraft Java 1.7.10: BlockReed (ane, original id 83), BlockCactus
// (ajt, 81), ItemReed (abi, Items.reeds 338), WorldGenReed (ash), WorldGenCactus (arh), WorldGenSand
// (asj) and the BiomeDecorator (aia) loops that call them. Checked against the unchanged classes by
// tools/verify-plants.mjs (public/research/plant-reference.json); see public/research/plants.md.
// world.js imports this module, so nothing from world.js is used at load time.
import { WATER, LAVA, FIRE, TALL_GRASS, SNOW_LAYER, LADDER, WEB, SAND, CACTUS, REEDS, SIZE, HEIGHT, isPlant } from "./world.js";
import { JRandom } from "./lakes.js";
import { populateSeed } from "./flowers.js";
import { lightOpacity } from "./lighting.js";

// Items.reeds (338), Items.paper (339) and Items.sugar (353) under this build's ids.
export const REEDS_ITEM = 327, PAPER = 328, SUGAR = 329;

const T = 0.0625;
// BlockCactus.getCollisionBoundingBoxFromPool: 1/16 in from the four sides and the top, so an
// entity can touch it (Entity.doBlockCollisions -> onEntityCollidedWithBlock); the selected box
// keeps the full height.
export const CACTUS_COLLISION = Object.freeze([T, 0, T, 1 - T, 1 - T, 1 - T]);
export const CACTUS_SELECTION = Object.freeze([T, 0, T, 1 - T, 1, 1 - T]);
// BlockReed: setBlockBounds(0.5 - 0.375, 0, 0.5 - 0.375, 0.5 + 0.375, 1, 0.5 + 0.375) for selection
// and rays; it has no collision box.
export const REED_BOUNDS = Object.freeze([0.125, 0, 0.125, 0.875, 1, 0.875]);

// Material.isSolid (awt.a) for this build's blocks: false for air, liquids, fire, plants (crops,
// tall grass, flowers, saplings, sugar cane), Material.circuits (torches, ladders) and the snow
// layer; true for everything else, cobwebs, leaves, glass, ice and cactus included.
export function materialSolid(b) {
  return !(b === 0 || b === WATER || b === LAVA || b === 20 || b === FIRE || b === SNOW_LAYER || b === LADDER || b === REEDS || isPlant(b));
}
// Material.isReplaceable (awt.j): air, water, lava, fire, tall grass (Material.vine) and the snow layer.
export const replaceable = (b) => b === 0 || b === WATER || b === LAVA || b === FIRE || b === TALL_GRASS || b === SNOW_LAYER;
// Material.blocksMovement (awt.c): solid materials except Material.web.
export const blocksMovement = (b) => b !== WEB && materialSolid(b);

const SIDES = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// BlockReed.canPlaceBlockAt (ane.c), also its canBlockStay (ane.j): on sugar cane, or on grass, dirt
// or sand with water (Material.water, still or flowing) beside that block. There is no test of the
// cell itself; ItemReed's canPlaceEntityOnSide adds the replaceable one.
export function reedCanStay(world, x, y, z) {
  const below = world.get(x, y - 1, z);
  if (below === REEDS) return true;
  if (below !== 1 && below !== 2 && below !== SAND) return false;
  return SIDES.some(([dx, dz]) => world.get(x + dx, y - 1, z + dz) === WATER);
}
// BlockCactus.canBlockStay (ajt.j): nothing solid on the four sides, and cactus or sand below.
export function cactusCanStay(world, x, y, z) {
  for (const [dx, dz] of SIDES) if (materialSolid(world.get(x + dx, y, z + dz))) return false;
  const below = world.get(x, y - 1, z);
  return below === CACTUS || below === SAND;
}
// BlockCactus.canPlaceBlockAt (ajt.c): Block.canPlaceBlockAt (a replaceable cell) and canBlockStay.
export const cactusCanPlace = (world, x, y, z) => replaceable(world.get(x, y, z)) && cactusCanStay(world, x, y, z);

// ItemReed.onItemUse (abi.a): a one-layer snow cell (metadata & 7 < 1) or tall grass is replaced in
// place; any other clicked block places on the clicked face (`adjacent`). Returns the cell, or null.
export function reedTarget(world, block, adjacent) {
  const b = world.get(...block);
  if ((b === SNOW_LAYER && (world.getMeta(...block) & 7) < 1) || b === TALL_GRASS) return [...block];
  return adjacent ? [...adjacent] : null;
}
// World.canPlaceEntityOnSide for sugar cane: no collision box, so only the replaceable cell and
// BlockReed.canPlaceBlockAt.
export const canPlaceReeds = (world, x, y, z) => replaceable(world.get(x, y, z)) && reedCanStay(world, x, y, z);

// Entity.doBlockCollisions (sa.I): the box contracted by 0.001, cells floor(min)..floor(max)
// inclusive; a cactus there calls onEntityCollidedWithBlock, attackEntityFrom(DamageSource.cactus, 1).
export function touchesCactus(world, box) {
  const e = 0.001;
  for (let x = Math.floor(box[0] + e); x <= Math.floor(box[3] - e); x++)
    for (let y = Math.floor(box[1] + e); y <= Math.floor(box[4] - e); y++)
      for (let z = Math.floor(box[2] + e); z <= Math.floor(box[5] - e); z++) if (world.get(x, y, z) === CACTUS) return true;
  return false;
}
// DamageSource.cactus (ro.g): 1 point, not unblockable (armour applies), not fire, exhaustion 0.3.
export const CACTUS_DAMAGE = 1;

// Sugar cane and cactus in a running world. `drop(stacks, x, y, z)` spawns item entities
// (Block.dropBlockAsItem), `broken(x, y, z, block)` plays World.func_147480_a's aux 2001 (break
// particles and sound) and `apply(changes)` receives [x, y, z, old, new] entries to render.
// Writes go through world.set, so the neighbour notification (world.onChange) cascades: breaking
// the bottom of a column brings the rest down one by one, as in the original.
export class Plants {
  constructor(world, { drop = () => {}, broken = () => {}, apply = () => {} } = {}) {
    this.world = world;
    this.drop = drop;
    this.broken = broken;
    this.apply = apply;
  }
  watch() {
    const next = this.world.onChange;
    this.world.onChange = (x, y, z, old, now) => {
      next?.(x, y, z, old, now);
      for (const [dx, dy, dz] of [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]]) this.neighbourChanged(x + dx, y + dy, z + dz);
    };
    return this;
  }
  // onNeighborBlockChange. BlockReed (func_150170_e): dropBlockAsItem then setBlockToAir, with no
  // particles. BlockCactus: func_147480_a(x, y, z, true), the full break with particles and drops.
  neighbourChanged(x, y, z) {
    const w = this.world, b = w.get(x, y, z);
    if (b === REEDS && !reedCanStay(w, x, y, z)) this.remove(x, y, z, b, false);
    else if (b === CACTUS && !cactusCanStay(w, x, y, z)) this.remove(x, y, z, b, true);
  }
  remove(x, y, z, b, particles) {
    if (particles) this.broken(x, y, z, b);
    this.drop([{ id: b === REEDS ? REEDS_ITEM : CACTUS, count: 1, damage: 0 }], x, y, z);
    this.world.set(x, y, z, 0);
    this.apply([[x, y, z, b, 0]]);
  }
  // updateTick from WorldServer's random ticks (both tickRandomly). BlockReed first runs
  // func_150170_e unless sugar cane is below; then both grow the same way: with air above and a
  // column under 3 high, the age (metadata) counts to 15, and at 15 a new block goes on top
  // (setBlock, flag 3) and the age returns to 0 (setBlockMetadataWithNotify flag 4: no
  // notification). BlockCactus then calls onNeighborBlockChange on the new block, which can break
  // it at once. Returns whether the block was one of these.
  randomTick(x, y, z, b = this.world.get(x, y, z)) {
    if (b !== REEDS && b !== CACTUS) return false;
    const w = this.world;
    if (b === REEDS && w.get(x, y - 1, z) !== REEDS && !reedCanStay(w, x, y, z)) {
      this.remove(x, y, z, b, false);
      return true;
    }
    if (w.get(x, y + 1, z) !== 0) return true;
    let l = 1;
    while (w.get(x, y - l, z) === b) l++;
    if (l >= 3) return true;
    const age = w.getMeta(x, y, z);
    if (age === 15) {
      if (w.set(x, y + 1, z, b, true, 0)) this.apply([[x, y + 1, z, 0, b]]);
      w.put(x, y, z, b, 0);
      if (b === CACTUS) this.neighbourChanged(x, y + 1, z);
    } else w.put(x, y, z, b, age + 1);
    return true;
  }
}

// WorldGenReed.generate (ash.a): 20 tries scattered up to 3 blocks on x and z at the same height;
// an air cell with water beside the block below gets a column of 2 + nextInt(nextInt(3) + 1),
// each level only where BlockReed.canBlockStay (setBlock flag 2).
export function generateReeds(world, rand, x, y, z, place = (px, py, pz) => world.set(px, py, pz, REEDS, false)) {
  for (let n = 0; n < 20; n++) {
    const i = x + rand.nextInt(4) - rand.nextInt(4), k = z + rand.nextInt(4) - rand.nextInt(4);
    if (world.get(i, y, k) !== 0 || !SIDES.some(([dx, dz]) => world.get(i + dx, y - 1, k + dz) === WATER)) continue;
    const h = 2 + rand.nextInt(rand.nextInt(3) + 1);
    for (let j = 0; j < h; j++) if (reedCanStay(world, i, y + j, k)) place(i, y + j, k);
  }
  return true;
}
// WorldGenCactus.generate (arh.a): 10 tries up to 7 away on x and z and 3 on y; an air cell gets
// 1 + nextInt(nextInt(3) + 1) levels, each only where BlockCactus.canBlockStay.
export function generateCactus(world, rand, x, y, z, place = (px, py, pz) => world.set(px, py, pz, CACTUS, false)) {
  for (let n = 0; n < 10; n++) {
    const i = x + rand.nextInt(8) - rand.nextInt(8), j = y + rand.nextInt(4) - rand.nextInt(4), k = z + rand.nextInt(8) - rand.nextInt(8);
    if (world.get(i, j, k) !== 0) continue;
    const h = 1 + rand.nextInt(rand.nextInt(3) + 1);
    for (let m = 0; m < h; m++) if (cactusCanStay(world, i, j + m, k)) place(i, j + m, k);
  }
  return true;
}
// WorldGenSand.generate (asj.a) as the decorator's sand generator (radius 7): only where the cell
// is water; a disc of radius nextInt(radius - 2) + 2 turns dirt and grass from y - 2 to y + 2 into
// sand (setBlock flag 2), x outer, then z, then y.
export function generateSand(world, rand, x, y, z, radius = 7, place = (px, py, pz) => world.set(px, py, pz, SAND, false)) {
  if (world.get(x, y, z) !== WATER) return false;
  const l = rand.nextInt(radius - 2) + 2;
  for (let i = x - l; i <= x + l; i++)
    for (let k = z - l; k <= z + l; k++) {
      const a = i - x, c = k - z;
      if (a * a + c * c > l * l) continue;
      for (let j = y - 2; j <= y + 2; j++) {
        const b = world.get(i, j, k);
        if (b === 2 || b === 1) place(i, j, k);
      }
    }
  return true;
}

// World.getTopSolidOrLiquidBlock (ahb.i): one above the highest block whose material blocks
// movement and is not leaves. Water does not block movement, so under water this is the cell
// above the bed.
export function topSolidOrLiquid(world, x, z) {
  for (let y = (world.height ?? HEIGHT) - 1; y > 0; y--) {
    const b = world.get(x, y, z);
    if (blocksMovement(b) && b !== 5) return y + 1;
  }
  return -1;
}
// Chunk.getHeightValue: one above the highest block with a light opacity.
export function heightValue(world, x, z) {
  for (let y = (world.height ?? HEIGHT) - 1; y > 0; y--) if (lightOpacity(world.get(x, y, z)) > 0) return y + 1;
  return 0;
}

// Generation version 8. One java.util.Random per 16 x 16 chunk (every chunk whose decoration area
// touches the world, as the flowers), seeded from ChunkProviderGenerate.populate's chunk seed with
// its own salt, so the lakes, trees and flowers of version 7 do not move. BiomeDecorator.decorate
// order: three sand discs first (sandPerChunk2 = 3, at getTopSolidOrLiquidBlock), here before the
// trees; then, after the flowers, reedsPerChunk (0 outside deserts and swamps) plus 10 more
// WorldGenReed calls at y = nextInt(getHeightValue * 2). No preset is a desert, so WorldGenCactus
// (cactiPerChunk 10 in BiomeGenDesert) never runs.
const SALT = 0x706c616e7473n; // "plants"
export function decorateSand(world) {
  const chunks = [];
  for (let cx = -1; cx * 16 < SIZE; cx++)
    for (let cz = -1; cz * 16 < SIZE; cz++) {
      const r = new JRandom(populateSeed(world.numericSeed, cx, cz) ^ SALT);
      for (let n = 0; n < 3; n++) {
        const x = cx * 16 + r.nextInt(16) + 8, z = cz * 16 + r.nextInt(16) + 8;
        generateSand(world, r, x, topSolidOrLiquid(world, x, z), z, 7);
      }
      chunks.push({ cx, cz, r });
    }
  return chunks;
}
export function decorateReeds(world, chunks, perChunk = 0) {
  for (const { cx, cz, r } of chunks)
    for (let n = 0; n < perChunk + 10; n++) {
      const x = cx * 16 + r.nextInt(16) + 8, z = cz * 16 + r.nextInt(16) + 8, h = heightValue(world, x, z) * 2;
      // The original always has a height here; outside this world's 128 x 128 the column is empty.
      if (h > 0) generateReeds(world, r, x, r.nextInt(h), z);
    }
}

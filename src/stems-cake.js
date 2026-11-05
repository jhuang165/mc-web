// BlockStem (anu: pumpkin stem 104, melon stem 105), the pumpkin/melon fruit rule, and BlockCake (aju, original 92) with ItemReed's
// cake item (original 354), Java 1.7.10. Evidence: tools/probes/StemCakeProbe.java -> public/research/stem-cake-reference.json,
// replayed by src/stems-cake.test.js; notes in public/research/stems-cake.md. No imports: world.js reads this file, so the
// block ids below are the internal ones world.js assigns (159-161) and the neighbours it needs are numbered here.
export const PUMPKIN_STEM = 159, MELON_STEM = 160, CAKE = 161, ITEM_CAKE = 1930;
export const STEM_CAKE_ITEMS = Object.freeze({ 354: ITEM_CAKE });
const PUMPKIN = 67, MELON = 81, GRASS = 1, DIRT = 2, FARMLAND_DRY = 29, FARMLAND_WET = 30;
const PUMPKIN_SEEDS = 361, MELON_SEEDS = 362, STICK_AIR = 0;
export const isStem = (b) => b === PUMPKIN_STEM || b === MELON_STEM;
export const isStemCake = (b) => b >= PUMPKIN_STEM && b <= CAKE;
export const fruitOf = (stem) => (stem === PUMPKIN_STEM ? PUMPKIN : MELON);
export const seedOf = (stem) => (stem === PUMPKIN_STEM ? PUMPKIN_SEEDS : MELON_SEEDS);
// ItemSeeds (pumpkin 361 / melon 362 place their stem on farmland); crops.js plantedBlock reads this.
export const stemPlantedBy = (item) => (item === PUMPKIN_SEEDS ? PUMPKIN_STEM : item === MELON_SEEDS ? MELON_STEM : 0);
export const STEM_CAKE_TILES = ['pumpkin_stem_disconnected', 'pumpkin_stem_connected', 'melon_stem_disconnected', 'melon_stem_connected', 'cake_top', 'cake_side', 'cake_bottom', 'cake_inner'];

const f = Math.fround;
// BlockStem.func_149741_i(meta): (meta * 32) << 16 | (255 - meta * 8) << 8 | meta * 4.
export const stemColor = (meta) => (((meta & 7) * 32) << 16) | ((255 - (meta & 7) * 8) << 8) | ((meta & 7) * 4);
export const stemTint = (meta) => { const c = stemColor(meta); return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]; };
// BlockStem.setBlockBoundsBasedOnState: 0.375-0.625 in x/z, height (meta * 2 + 2) / 16 (a float).
export const stemBounds = (meta) => [0.375, 0, 0.375, 0.625, f(((meta & 7) * 2 + 2) / 16), 0.625];
// BlockStem.func_149873_e: the direction (0 x-1, 1 x+1, 2 z-1, 3 z+1) of the fruit beside a full-grown stem, else -1.
export function stemDirection(world, x, y, z, stem) {
  if ((world.getMeta(x, y, z) & 15) < 7) return -1;
  const fruit = fruitOf(stem);
  if (world.get(x - 1, y, z) === fruit) return 0;
  if (world.get(x + 1, y, z) === fruit) return 1;
  if (world.get(x, y, z - 1) === fruit) return 2;
  if (world.get(x, y, z + 1) === fruit) return 3;
  return -1;
}
const FARMLAND = (b) => b === FARMLAND_DRY || b === FARMLAND_WET;
// BlockStem.func_149875_n (growth rate): the BlockCrops formula with the stem itself as the "same crop" (moisture of each
// farmland cell from `moisture(x, y, z)`: > 0 is hydrated).
export function stemGrowthRate(world, x, y, z, moisture) {
  let rate = 1;
  const self = world.get(x, y, z);
  for (let dx = x - 1; dx <= x + 1; dx++)
    for (let dz = z - 1; dz <= z + 1; dz++) {
      const below = world.get(dx, y - 1, dz);
      let v = 0;
      if (FARMLAND(below)) { v = 1; if ((moisture(dx, y - 1, dz) ?? 0) > 0) v = 3; }
      if (dx !== x || dz !== z) v = f(v / 4);
      rate = f(rate + v);
    }
  const row = world.get(x - 1, y, z) === self || world.get(x + 1, y, z) === self;
  const column = world.get(x, y, z - 1) === self || world.get(x, y, z + 1) === self;
  const diagonal = [[-1, -1], [1, -1], [1, 1], [-1, 1]].some(([a, b]) => world.get(x + a, y, z + b) === self);
  if (row && column || diagonal) rate = f(rate / 2);
  return rate;
}
// BlockStem.updateTick after the light test (`light` = the light value at y + 1). `rand.nextInt(n)` is a java.util.Random.
// Returns the cell writes as [x, y, z, block, meta] (stem ageing or the fruit), or [].
export function stemTick(world, x, y, z, rand, { light, moisture }) {
  if (light < 9) return [];
  const rate = stemGrowthRate(world, x, y, z, moisture);
  if (rand.nextInt(Math.trunc(f(25 / rate)) + 1) !== 0) return [];
  const stem = world.get(x, y, z), meta = world.getMeta(x, y, z) & 15;
  if (meta < 7) return [[x, y, z, stem, meta + 1]];
  const fruit = fruitOf(stem);
  if (world.get(x - 1, y, z) === fruit || world.get(x + 1, y, z) === fruit || world.get(x, y, z - 1) === fruit || world.get(x, y, z + 1) === fruit) return [];
  const dir = rand.nextInt(4);
  let tx = x, tz = z;
  if (dir === 0) tx--;
  if (dir === 1) tx++;
  if (dir === 2) tz--;
  if (dir === 3) tz++;
  const under = world.get(tx, y - 1, tz);
  if (world.get(tx, y, tz) === STICK_AIR && (FARMLAND(under) || under === DIRT || under === GRASS)) return [[tx, y, tz, fruit, 0]];
  return [];
}
// BlockStem.func_149853_b (ItemDye bone meal): meta + nextInt(4) + 2 capped at 7 (always applies below age 7).
export const stemCanFertilize = (meta) => (meta & 15) !== 7;
export const stemFertilized = (meta, rand) => Math.min(7, (meta & 15) + 2 + rand.nextInt(4));
// BlockStem.dropBlockAsItemWithChance: three rolls of nextInt(15) <= meta, one seed each (the stem has no item of its own).
export function stemDrops(stem, meta, nextInt) {
  let count = 0;
  for (let i = 0; i < 3; i++) if (nextInt(15) <= (meta & 15)) count++;
  return count ? [{ id: seedOf(stem), count }] : [];
}
// BlockBush.canBlockStay (support part): a stem needs farmland below (BlockStem.canPlaceBlockOn).
export const stemSupported = (world, x, y, z) => FARMLAND(world.get(x, y - 1, z));

// BlockCake.setBlockBoundsBasedOnState / getCollisionBoundingBoxFromPool / getSelectedBoundingBoxFromPool.
export const cakeBounds = (meta) => [f(f(1 + (meta & 15) * 2) / 16), 0, f(1 / 16), f(1 - 0.0625), 0.5, f(1 - 0.0625)];
// BlockCake.canBlockStay: the block below has a solid material (Material.isSolid); `solid` is the world's test.
let materialSolid = null;
export const setCakeSolid = (fn) => { materialSolid = fn; }; // signs.js supplies its probe-derived Material.isSolid table (world.js cannot import it)
export const cakeSupported = (world, x, y, z) => (materialSolid ? materialSolid(world.get(x, y - 1, z)) : world.solid(x, y - 1, z));
// BlockCake.func_150036_b (eatCakeSlice) after canEat(false) (hungry and not in Creative): addStats(2, 0.1); metadata + 1, cleared at 6.
export function cakeEat(survival, world, x, y, z) {
  if (survival.creative || survival.food >= 20) return { ate: false };
  survival.food = Math.min(20, survival.food + 2);
  survival.saturation = Math.min(survival.food, f(survival.saturation + f(f(2 * f(0.1)) * 2)));
  const next = (world.getMeta(x, y, z) & 15) + 1;
  return { ate: true, next: next >= 6 ? null : next };
}
// ItemReed.onItemUse for the cake item: the clicked cell, or its neighbour on the clicked face, must be replaceable (`replaceable`),
// at most the top of the world, and the cake needs a solid block below (BlockCake.canPlaceBlockAt). Returns the cell or null.
export function cakePlacement(world, target, replaceable) {
  const here = target.block;
  const cells = replaceable(world.get(...here)) ? [here] : [target.adjacent].filter(Boolean);
  const [x, y, z] = cells[0] ?? [];
  if (x === undefined || y < 0 || y >= (world.height ?? 256) - 1 || (world.inside && !world.inside(x, y, z))) return null;
  if (!replaceable(world.get(x, y, z)) || !cakeSupported(world, x, y, z)) return null;
  return [x, y, z];
}
// Neighbour-change result for one cell, as BlockBush/BlockStem and BlockCake.onNeighborBlockChange: the drops of a cell that can no
// longer stay ([] for the cake, seeds for the stem), or null when it stays.
export function popDrops(world, x, y, z, random = Math.random) {
  const b = world.get(x, y, z);
  if (isStem(b)) return stemSupported(world, x, y, z) ? null : stemDrops(b, world.getMeta(x, y, z), (n) => Math.floor(random() * n));
  if (b === CAKE) return cakeSupported(world, x, y, z) ? null : [];
  return null;
}
// Drops for the break path (population-content.js populationDrops).
export function stemCakeDrops(id, meta, random = Math.random) {
  if (id === CAKE) return [];
  return stemDrops(id, meta, (n) => Math.floor(random() * n));
}
// Items, materials and the cake recipe the survival tables install (survival.js).
export function installStemCakeItems(items) {
  items[ITEM_CAKE] = { id: ITEM_CAKE, name: 'Cake', texture: 'cake', stack: 1, color: '#e8d6c4', glyph: 'C' };
  // BlockStem and BlockCake have no block items (the seeds and ItemReed's cake do), so drop the entries survival.js builds per block.
  for (const b of [PUMPKIN_STEM, MELON_STEM, CAKE]) delete items[b];
  items[343].craftContainer = 340; // ItemBucketMilk: setContainerItem(bucket)
}
// BlockStem hardness 0 and BlockCake hardness 0.5 (no tool needed); the drops come from stemCakeDrops.
export function installStemCakeMaterials(m) {
  m[PUMPKIN_STEM] = { hardness: 0, drop: 0 };
  m[MELON_STEM] = { hardness: 0, drop: 0 };
  m[CAKE] = { hardness: 0.5, drop: 0 };
}
// CraftingManager: "AAA", "BEB", "CCC" with milk buckets, sugar, egg and wheat -> cake (milk buckets leave empty buckets).
export function installStemCakeRecipes({ recipe }) {
  recipe('cake', 'Cake', ['AAA', 'BEB', 'CCC'], { A: 343, B: 329, E: 316, C: 305 }, ITEM_CAKE);
}

// Render geometry for scene.js (block-local coordinates, uv as fractions of the tile, v from the top):
// RenderBlocks.renderBlockStem: always the small stem (two diagonal planes, cropped to the block height), plus, beside a fruit, the
// connected texture on a plane through the stem toward it. The big-stem plane geometry is approximated (bytecode of func_147740_a not replayed).
export function stemQuads(meta, dir) {
  const quads = [], h = dir < 0 ? stemBounds(meta)[4] : 0.5, vb = h;
  for (const [a, b] of [[[0, 0], [1, 1]], [[1, 0], [0, 1]]])
    quads.push({ tile: 'disconnected', verts: [[a[0], h, a[1]], [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]]], uvs: [[0, 0], [0, vb], [1, vb], [1, 0]] });
  if (dir >= 0) {
    const alongX = dir < 2, flip = dir === 0 || dir === 2, u = flip ? [1, 0] : [0, 1];
    const p = (t) => (alongX ? [t, 0.5] : [0.5, t]);
    quads.push({ tile: 'connected', verts: [[p(0)[0], 1, p(0)[1]], [p(0)[0], 0, p(0)[1]], [p(1)[0], 0, p(1)[1]], [p(1)[0], 1, p(1)[1]]], uvs: [[u[0], 0], [u[0], 1], [u[1], 1], [u[1], 0]] });
  }
  return quads;
}

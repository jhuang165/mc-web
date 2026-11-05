// BlockNetherWart (amf, original block 115), Java 1.7.10. Evidence: tools/probes/PortalWartProbe.java ->
// public/research/portal-wart-reference.json, replayed by src/nether-portal-wart.test.js; notes in public/research/nether.md.
// No imports: world.js reads this file. Internal ids: 170 nether wart, 151 soul sand (nether-blocks.js), item 386 (brewing.js).
export const NETHER_WART = 170, SOUL_SAND = 151, ITEM_NETHER_WART = 386;
// ItemSeedFood-like planting: ItemSeeds(netherWart -> soul sand). Original item 372 is the internal item 386.
export const wartPlantedBy = (item) => (item === ITEM_NETHER_WART ? NETHER_WART : 0);
export const wartCanStay = (world, x, y, z) => world.get(x, y - 1, z) === SOUL_SAND;
// BlockBush.canPlaceBlockAt: the cell is replaceable (air, fluids, snow layer, plants, fire ...) and the block can stay.
export const wartCanPlace = (world, x, y, z, replaceable = (b) => b === 0) => replaceable(world.get(x, y, z)) && wartCanStay(world, x, y, z);
// Block bounds: 0.5 - 0.5 .. 0.5 + 0.5 horizontally, 0.25 high ([minX, minY, minZ, maxX, maxY, maxZ]).
export const WART_BOUNDS = Object.freeze([0, 0, 0, 1, 0.25, 1]);
export const wartAge = (meta) => meta & 3;
// Texture stage (BlockNetherWart.getIcon): age 3 -> stage 2, ages above 0 -> stage 1, else stage 0.
export const wartStage = (meta) => (meta >= 3 ? 2 : meta > 0 ? 1 : 0);
export const WART_TILES = ["nether_wart_stage_0", "nether_wart_stage_1", "nether_wart_stage_2"];
// BlockNetherWart.updateTick: growth first (age < 3 and nextInt(10) == 0 adds one: flag 2), then BlockBush.updateTick's support check
// (a wart that cannot stay is removed and dropped through wartDropCount with the meta it has then). Returns {meta, removed}.
export function wartTick(world, x, y, z, rand) {
  let meta = world.getMeta(x, y, z);
  if (meta < 3 && rand.nextInt(10) === 0) { meta++; world.set(x, y, z, NETHER_WART, true, meta); }
  return { meta, removed: !wartCanStay(world, x, y, z) };
}
// BlockNetherWart.dropBlockAsItemWithChance: 1 seed; mature (meta >= 3) 2 + nextInt(3), plus nextInt(fortune + 1) with Fortune. Each item
// then draws three offsets from the world Random (Block.dropBlockAsItem: nextFloat * 0.7F + 0.15F for x, y, z). Returns {count, offsets}.
export function wartDropCount(meta, fortune, rand, offsets = false) {
  let n = 1;
  if (meta >= 3) { n = 2 + rand.nextInt(3); if (fortune > 0) n += rand.nextInt(fortune + 1); }
  const out = [];
  if (offsets) for (let i = 0; i < n; i++) { const f = Math.fround(0.7), d = () => Math.fround(rand.nextFloat() * f) + Math.fround(Math.fround(1 - f) * 0.5); out.push([d(), d(), d()]); }
  return { count: n, offsets: out };
}

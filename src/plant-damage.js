// b82 pots82: the item damage a rose or sapling cell drops, picks and washes to, for any metadata (a rawDamage stack can place metas the catalogue has no
// variant for). Bytecode-read (1.7.10 jar): BlockFlower.damageDropped (alc.a(I)I) returns the metadata, BlockSapling.damageDropped (anj.a(I)I) returns
// MathHelper.clamp_int(meta & 7, 0, 5); getDamageValue (pick) goes through damageDropped. A rose damage past the 9 catalogue variants is the port's
// rawDamage convention: the item at damage 0 with rawDamage = the native damage (stone-utility.js potDropEntry).
import { RED_FLOWER, SAPLING, YELLOW_FLOWER, DOUBLE_PLANT, DEAD_SHRUB, TALL_GRASS, FERN } from "./world.js";

export const ROSE_VARIANTS = 9;
// { damage, tags? } for a drop of `block` with metadata `meta`, or null when the block is not a rose or sapling.
export function plantDropDamage(block, meta) {
  if (block === SAPLING) return { damage: Math.min(5, meta & 7) };
  if (block === YELLOW_FLOWER || block === DEAD_SHRUB) return single(meta & 15);
  if (block === DOUBLE_PLANT) return doublePlantDamage(meta);
  if (block !== RED_FLOWER) return null;
  const m = meta & 15;
  return m < ROSE_VARIANTS ? { damage: m } : { damage: 0, tags: { rawDamage: m } };
}

// b83 plants83 (bytecode-read, 1.7.10 jar). The dandelion (BlockFlower type 0, alc) and the tall grass item (ItemColored abr over BlockTallGrass anz)
// keep their damage as the placed metadata and drop/pick it back (damageDropped and getDamageValue return the meta); the port has one variant for each
// (dandelion 43 and the shrub 83, tallgrass:0), so any other damage is rawDamage on damage 0. Tallgrass 1 and 2 are the port's own items 39 and 84.
const single = (m) => (m ? { damage: 0, tags: { rawDamage: m } } : { damage: 0 });
export const DOUBLE_PLANT_VARIANTS = 6;
// BlockDoublePlant (ako): damageDropped a(I) is meta & 7 for the lower half (0 for the top, which getItemDropped makes drop nothing); the
// ItemDoublePlant (aci) has 6 named variants, so types 6 and 7 (a rawDamage stack's) keep rawDamage.
export function doublePlantDamage(meta) {
  const t = meta & 7;
  return t < DOUBLE_PLANT_VARIANTS ? { damage: t } : { damage: 0, tags: { rawDamage: t } };
}
// BlockTallGrass.harvestBlock with shears: ItemStack(tallgrass, 1, meta). The port's tallgrass:1 is tall grass 39 and tallgrass:2 the fern 84.
export function tallGrassShearStack(block, meta) {
  if (block === TALL_GRASS) return { id: TALL_GRASS, count: 1 };
  if (block === FERN) return { id: FERN, count: 1 };
  return block === DEAD_SHRUB ? { id: DEAD_SHRUB, count: 1, ...single(meta & 15) } : null;
}
// The cell a damage-0 dandelion or shrub stack with rawDamage `raw` places: ItemColored/ItemMultiTexture.getMetadata return the damage, so
// tallgrass:1/2 are the port's 39/84 cells and the rest keep the meta (& 15, the nibble World.setBlock stores).
export function rawDamageCell(block, raw) {
  const m = raw & 15;
  if (block === DEAD_SHRUB) return m === 1 ? { id: TALL_GRASS, meta: 0 } : m === 2 ? { id: FERN, meta: 0 } : { id: DEAD_SHRUB, meta: m };
  return { id: block, meta: m };
}
// Block.getDamageValue for the pick-block key (Minecraft.middleClickMouse): BlockFlower/BlockTallGrass use the cell's meta; BlockDoublePlant.k reads
// the lower half's meta & 7 for a top half (meta & 8), its own meta & 7 otherwise. { id, damage, rawDamage? } or null for other blocks.
export function plantPick(world, x, y, z) {
  const block = world.get(x, y, z);
  if (block !== YELLOW_FLOWER && block !== RED_FLOWER && block !== DEAD_SHRUB && block !== DOUBLE_PLANT) return null;
  let meta = world.getMeta(x, y, z);
  if (block === DOUBLE_PLANT && meta & 8) meta = world.getMeta(x, y - 1, z);
  const d = plantDropDamage(block, meta);
  return { id: block, damage: d.damage, rawDamage: d.tags?.rawDamage };
}

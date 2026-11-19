// b82 pots82: the item damage a rose or sapling cell drops, picks and washes to, for any metadata (a rawDamage stack can place metas the catalogue has no
// variant for). Bytecode-read (1.7.10 jar): BlockFlower.damageDropped (alc.a(I)I) returns the metadata, BlockSapling.damageDropped (anj.a(I)I) returns
// MathHelper.clamp_int(meta & 7, 0, 5); getDamageValue (pick) goes through damageDropped. A rose damage past the 9 catalogue variants is the port's
// rawDamage convention: the item at damage 0 with rawDamage = the native damage (stone-utility.js potDropEntry).
import { RED_FLOWER, SAPLING } from "./world.js";

export const ROSE_VARIANTS = 9;
// { damage, tags? } for a drop of `block` with metadata `meta`, or null when the block is not a rose or sapling.
export function plantDropDamage(block, meta) {
  if (block === SAPLING) return { damage: Math.min(5, meta & 7) };
  if (block !== RED_FLOWER) return null;
  const m = meta & 15;
  return m < ROSE_VARIANTS ? { damage: m } : { damage: 0, tags: { rawDamage: m } };
}

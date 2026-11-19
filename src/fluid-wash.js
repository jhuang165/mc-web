// What a liquid washing over a block drops (Block.dropBlockAsItem on BlockDynamicLiquid.func_149813_h): cobweb string, torch-like block 20, flowers, saplings and crops.
// Shared by the single-player Fluids hook in main.js and the dedicated server's (multiplayer/server-bucket.js). Returns stacks (maybe empty).
import { WEB, RED_FLOWER, SAPLING, isFlower } from "./world.js";
import { cropDrops } from "./farming.js";
import { makeStack } from "./inventory.js";
import { plantDropDamage } from "./plant-damage.js";
import { FLOWER_POT, ITEM_FLOWER_POT, potBreakDrop, potEntryStack } from "./stone-utility.js";

// b82 pots82: what the liquid's setBlock leaves through the old block's breakBlock (Chunk.func_150807_a runs it on the server): a flower pot's stored stack
// (BlockFlowerPot.breakBlock, ald.a; bytecode-read). Lava (no dropBlockAsItem, only the fizz) drops just this.
export function burnStacks(world, x, y, z, b) {
  const e = b === FLOWER_POT ? potBreakDrop(world, x, y, z) : null;
  return e?.id ? [potEntryStack(e, makeStack)] : [];
}
export function washStacks(world, x, y, z, b, random = Math.random) {
  if (b === FLOWER_POT) return [makeStack(ITEM_FLOWER_POT, 1, 0), ...burnStacks(world, x, y, z, b)]; // dropBlockAsItem (the pot item), then breakBlock (the plant)
  const d = b === WEB ? [{ id: 321, count: 1 }] : b === 20 ? [{ id: 20, count: 1 }] : isFlower(b) || b === SAPLING ? [{ id: b, count: 1, ...(plantDropDamage(b, world.getMeta(x, y, z)) ?? { damage: 0 }) }] : cropDrops(b, random, world.getMeta(x, y, z));
  return (d ?? []).map((e) => makeStack(e.id, e.count, e.damage || 0, undefined, e.tags)); // b82 pots82: plant-damage.js (rose rawDamage, sapling clamp)
}

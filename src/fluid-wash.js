// What a liquid washing over a block drops (Block.dropBlockAsItem on BlockDynamicLiquid.func_149813_h): cobweb string, torch-like block 20, flowers, saplings and crops.
// Shared by the single-player Fluids hook in main.js and the dedicated server's (multiplayer/server-bucket.js). Returns stacks (maybe empty).
import { WEB, RED_FLOWER, SAPLING, isFlower } from "./world.js";
import { cropDrops } from "./farming.js";
import { makeStack } from "./inventory.js";

export function washStacks(world, x, y, z, b, random = Math.random) {
  const d = b === WEB ? [{ id: 321, count: 1 }] : b === 20 ? [{ id: 20, count: 1 }] : isFlower(b) ? [{ id: b, count: 1, damage: b === RED_FLOWER ? world.getMeta(x, y, z) : 0 }] : b === SAPLING ? [{ id: b, count: 1, damage: world.getMeta(x, y, z) & 7 }] : cropDrops(b, random, world.getMeta(x, y, z));
  return (d ?? []).map((e) => makeStack(e.id, e.count, e.damage || 0));
}

// BlockRedstoneOre (original ids 73 unlit / 74 lit, internal REDSTONE_ORE 64 / LIT_REDSTONE_ORE 65), Java 1.7.10.
// Evidence: public/research/redstone-ore-reference.json (tools/probes/RedstoneOreProbe.java on the unchanged classes);
// notes in public/research/redstone-ore.md.
//
//   onBlockClicked, onEntityWalking and onBlockActivated all run func_150185_e: the reddust sparkle of func_150186_m
//     (oreSparkle in redstone-particles.js: six faces, 0.0625 out, only over a non-opaque neighbour), then, when the block
//     is the unlit ore, World.setBlock(lit ore) (metadata 0). The lit ore only sparkles; it is not refreshed and schedules
//     nothing. onBlockActivated returns false, so a held item still gets its onItemUse (a block is still placed).
//   The lit ore ticks randomly (tickRate 30 is never scheduled): updateTick sets the unlit ore back. Light value 9 (0.625F).
//   Drops, experience and Silk Touch (createStackedBlock is the unlit ore) are enchantment-effects.js RULES[73] / [74].
import { REDSTONE_ORE, LIT_REDSTONE_ORE } from "./world.js";
import { oreSparkle } from "./redstone-particles.js";

export const TICK_RATE = 30; // Block.tickRate; nothing schedules it
export const LIT_LIGHT_VALUE = 9; // setLightLevel(0.625F): (int)(15 * 0.625F)
export const isRedstoneOre = (b) => b === REDSTONE_ORE || b === LIT_REDSTONE_ORE;
export const ON_BLOCK_ACTIVATED_RESULT = false; // BlockRedstoneOre.onBlockActivated falls through to Block's false

// func_150185_e at (x, y, z): the sparkle (always), then unlit -> lit. `rand` is World.rand, `spawn(name, x, y, z, vx, vy, vz)`
// takes the reddust particles (omit for none) and `changed([[x, y, z, old, new]])` hears the swap. True when it swapped.
export function touchRedstoneOre(world, x, y, z, { rand, spawn, changed } = {}) {
  const b = world.get(x, y, z);
  if (!isRedstoneOre(b)) return false;
  if (rand && spawn) oreSparkle(world, x, y, z, rand, { spawn });
  if (b !== REDSTONE_ORE) return false;
  world.set(x, y, z, LIT_REDSTONE_ORE, true, 0);
  changed?.([[x, y, z, REDSTONE_ORE, LIT_REDSTONE_ORE]]);
  return true;
}

// BlockRedstoneOre.updateTick: the lit ore reverts (World.setBlock(unlit ore)); the unlit ore does nothing.
export function randomTickRedstoneOre(world, x, y, z, { changed } = {}) {
  if (world.get(x, y, z) !== LIT_REDSTONE_ORE) return false;
  world.set(x, y, z, REDSTONE_ORE, true, 0);
  changed?.([[x, y, z, LIT_REDSTONE_ORE, REDSTONE_ORE]]);
  return true;
}

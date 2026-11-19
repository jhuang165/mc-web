// Batch 75 mpbuckets75: ItemBucket.onItemRightClick on the dedicated server. The single-player modules do the work (buckets.js traceBucket / useBucketAt,
// the same code client prediction draws with); this file is the server glue only:
//   * the ray is the server's own (eye from the player's position, yaw and pitch), 5 blocks, liquids only for an empty bucket (Item.getMovingObjectPositionFromPlayer);
//   * World.canMineBlock (spawn protection) at the hit block, then EntityPlayer.canPlayerEdit (Adventure refuses) at the hit block (empty) or the adjacent cell (full);
//   * an empty bucket takes a water/lava source (metadata 0) and the filled bucket goes to the inventory, or replaces a lone bucket, or is thrown when the inventory is full;
//     a full bucket sets its liquid on the adjacent cell (a replaceable block is broken with drops) and becomes an empty bucket; Creative keeps the stack both ways;
//   * the Nether turns water into `random.fizz` (volume 0.5, pitch 2.6 + (r - r) * 0.8, cell centre, to everyone within 16 blocks, the user included) and the bucket is still used;
//     the 8 largesmoke particles are client-only (World.spawnParticle does nothing on the server), the clicking client draws them from its own prediction;
//   * ItemBucket calls no addStat (bytecode-read, `abo.a(add, ahb, yz)`), so there is no use statistic.
// The block change goes out through the world's own change tracking and wakes the server's Fluids (World.set with a change callback), so the liquid flows on the next ticks.
import { traceBucket, useBucketAt } from '../buckets.js';
import { tracedBucketKind } from '../buckets-simulation.js';
import { blockProtected } from './server-properties.js';
import { washStacks, burnStacks } from '../fluid-wash.js';

const f = Math.fround;

/** BlockLiquid / ItemBucket fizz: `random.fizz` at a cell (x, y, z are the cell's corner), to everyone near in `dim`. `pitch` is given by Fluids (its own random) or drawn here. */
export function fizzSound(sim, dim, x, y, z, pitch) {
  pitch ??= f(f(2.6) + f(f(sim.soundRand.nextFloat() - sim.soundRand.nextFloat()) * f(0.8)));
  sim.soundsOut.push({ name: 'random.fizz', x: x + 0.5, y: y + 0.5, z: z + 0.5, volume: f(0.5), pitch, except: null, dim: dim | 0 });
}

/** The `fizz` callback a server `Fluids` of dimension `dim` takes (BlockLiquid.func_149799_m: lava meeting water). Position is already the cell centre. */
export const fluidFizz = (sim, dim) => (x, y, z, pitch) => { sim.soundsOut.push({ name: 'random.fizz', x, y, z, volume: f(0.5), pitch, except: null, dim: dim | 0 }); };

/**
 * Gives a server `Fluids` of dimension `dim` its two world effects: lava meeting water fizzes (S29 `random.fizz`), and a liquid washing over a torch, web, flower, sapling or crop drops
 * it as an item (Block.dropBlockAsItem; fluid-wash.js). `itemsOf()` is that dimension's item list (the Nether's differs from sim.items while another world is swapped in).
 */
export function installFluidHooks(fluids, sim, dim, itemsOf) {
  fluids.onFizz = fluidFizz(sim, dim);
  fluids.wash = (x, y, z, b) => { const d = washStacks(fluids.world, x, y, z, b); if (d.length) itemsOf().dropBlock(d, x, y, z); };
  fluids.burn = (x, y, z, b) => { const d = burnStacks(fluids.world, x, y, z, b); if (d.length) itemsOf().dropBlock(d, x, y, z); }; // b82 pots82: lava over a pot drops its plant
}

/**
 * Right click with a bucket in the player's dimension (the caller runs inside `dimensions.within`, so sim.world / sim.items are that dimension's).
 * `eye` and `dir` are the server's own ray. Returns true when the bucket was used (a liquid taken or placed, or the Nether's fizz).
 */
export function bucketUse(sim, p, eye, dir) {
  const s = p.survival, kind = tracedBucketKind(s?.held?.id);
  if (!kind) return false;
  const w = sim.world, empty = kind === 'empty';
  const hit = traceBucket(w, [eye.x, eye.y, eye.z], [dir.x, dir.y, dir.z], empty);
  if (!hit) return false;
  if (blockProtected(sim, p, hit.block)) return false; // World.canMineBlock on the traced block (both branches)
  // EntityPlayer.canPlayerEdit(x, y, z, side, stack) = allowEdit || stack != null && Item.canItemEditBlocks (`return true` for every item, bytecode-read yz.a, add.z, adb.v): the bucket is
  // the stack in hand, so Adventure passes. (b77: the old `if (s.adventure) return false` refused every Adventure bucket; isCurrentToolAdventureModeExempt is for digging only.)
  const dim = p.dimension | 0;
  const before = w.evaporated;
  w.evaporated = (x, y, z) => fizzSound(sim, dim, x, y, z); // placeContainedLiquid's Nether branch (the world is the Nether only where isHell)
  try {
    const used = useBucketAt(w, s, hit, {
      drop: stack => sim.items.dropPlayer(stack, p.position, p.yaw, p.pitch), // dropPlayerItemWithRandomChoice
      destroy: (x, y, z, b) => { sim.fluids.wash(x, y, z, b); }, // World.func_147480_a: the replaced plant breaks with its drops
    });
    return !!used;
  } finally { w.evaporated = before; }
}

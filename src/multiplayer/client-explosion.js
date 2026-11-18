// Batch 80 mpfx80: the block half of NetHandlerPlayClient.handleExplosion (bjb.a(gu)) on the port's client, and the client copy's fireball smoke.
//
// Bytecode-read (javap -c -p, 1.7.10 jar):
//   * bjb.a(gu) builds `new agw(world, null, x, y, z, size)` (agw.<init> sets isSmoking `b` true and leaves isFlaming `a` false), sets its list to the packet's cells and runs
//     doExplosionB(true) on the WorldClient. For each listed cell, after its two particles (explode, smoke), a cell whose block material is not air gets
//     `dropBlockAsItemWithChance(world, x, y, z, meta, 1 / size, 0)` when `canDropFromExplosion` (true but for TNT), then `setBlock(x, y, z, air, 0, 3)`, then
//     `onBlockDestroyedByExplosion` (only BlockTNT `aob` and BlockStairs `ans` override it; TNT returns at once on a remote world, stairs pass to their model block, a no-op).
//     The flaming pass does not run (isFlaming false), so the client lights no fire.
//   * Block.dropBlockAsItemWithChance (aji) returns at once on a remote world, but three overrides draw on World.rand first, before their (remote-guarded) XP drop `aji.c`:
//     BlockOre (amn): when getItemDropped is not the block itself, coal ore qh.a(rand, 0, 2), diamond and emerald ore qh.a(rand, 3, 7), lapis and quartz ore qh.a(rand, 2, 5)
//     (gold and iron ore drop themselves: no draw); BlockRedstoneOre (amz, ids 73 and 74): 1 + nextInt(5); BlockMobSpawner (ama): 15 + nextInt(15) + nextInt(15).
//     qh.a(rand, min, max) is one nextInt(max - min + 1). These draws come from the same World.rand as the particle offsets, so they shift the later cells' particles.
//
// The port's order differs from native: the server's block changes of a tick ride the `tick` message, which reaches the client BEFORE that tick's dispFx (natively the S27 is sent
// inside WorldServer.newExplosion and the S22/S23 block changes follow at PlayerManager.updatePlayerInstances). So the client remembers, per tick, the cells the server already
// changed and what they held before (`note`): such a cell is seen with its old block (native S27 time) for the draws and is not touched again (the server's newer state stays);
// a listed cell the server did not change this tick is cleared here, as native doExplosionB does on a desynchronised client.
import { toOriginal } from '../block-registry.js';
import { presentCells } from './client-chunks.js';
import { waterAcceleration, entityWaterBox } from '../fluids.js';
import { FIREBALL } from '../blaze-ghast.js';
import { SKULL } from '../wither-boss.js';
import { flyBallRow } from './fireball-copy.js'; // b81 blast81

const nextInts = (...bounds) => (r) => { for (const b of bounds) r.nextInt(b); };
// Native block id -> the World.rand draws of its client-side dropBlockAsItemWithChance.
export const S27_CLIENT_DROP_DRAWS = Object.freeze({
  16: nextInts(3), 56: nextInts(5), 129: nextInts(5), 21: nextInts(4), 153: nextInts(4), // BlockOre
  73: nextInts(5), 74: nextInts(5), // BlockRedstoneOre, unlit and lit
  52: nextInts(15, 15), // BlockMobSpawner
});
export const nativeBlockId = (id, meta = 0) => (id ? toOriginal(id, meta)?.[0] ?? -1 : 0);
export function clientDropDraws(id, meta, r) { S27_CLIENT_DROP_DRAWS[nativeBlockId(id, meta)]?.(r); }

export class S27ClientBlocks {
  constructor() { this.covered = new Map(); }
  // A new tick message: the cells it changes replace the last tick's.
  newTick() { this.covered.clear(); }
  // The server changed (x, y, z) this tick; `id` / `meta` is what the client held before. The first note of a tick wins (the state before that tick).
  note(x, y, z, id, meta) { const k = `${x},${y},${z}`; if (!this.covered.has(k)) this.covered.set(k, [id, meta]); }
  // doExplosionB(true)'s block step for one listed cell, after its particles (ExplosionParticles.burst `cell`). `r` is the client's World.rand; cleared cells join `out`
  // as scene.updateBlocks rows [x, y, z, old, 0].
  cell(world, x, y, z, r, out) {
    if (!presentCells(world, [[x, y, z]]).length) return; // an absent column reads as air (the WorldClient's empty chunk)
    const seen = this.covered.get(`${x},${y},${z}`), id = seen ? seen[0] : world.get(x, y, z), meta = seen ? seen[1] : world.getMeta(x, y, z);
    if (!id) return;
    if (r) clientDropDraws(id, meta, r);
    if (seen) return; // the server's own change of this cell is already applied: not applied twice
    world.put(x, y, z, 0, 0, false);
    out.push([x, y, z, id, 0]);
  }
  // The whole block pass of one S27 (for callers that draw no particles).
  apply(world, cells, r = null) { const out = []; for (const [x, y, z] of cells) this.cell(world, x, y, z, r, out); return out; }
}

// The client copy of a flying fireball, small fireball or wither skull runs ze.h itself (no isRemote guard around its particles): after the move, in water four `bubble` at
// the new position minus a quarter of the motion (moving with it), then a `smoke` at (x, y + 0.5, z). The port's client has no flight of its own: each dispEnts row is the
// server's post-move position, its motion is the row's position delta, and the water test is the client's own, on the box at the previous position (Entity.handleWaterMovement
// runs at the start of the update, before the move).
export const SMOKING_BALLS = new Set(['fireball', 'smallFireball', 'witherSkull']);
export function clientBallFx(row, { spawn, wet = () => false, world = null }) {
  if (!SMOKING_BALLS.has(row.kind)) return;
  if (row.track && flyBallRow(row, { world, wet, spawn })) return; // b81 blast81: a server that sends the tracker field: the copy flies itself (fireball-copy.js)
  const vx = row.x - row.px, vy = row.y - row.py, vz = row.z - row.pz;
  if (wet(row)) for (let i = 0; i < 4; i++) spawn('bubble', row.x - vx * 0.25, row.y - vy * 0.25, row.z - vz * 0.25, vx, vy, vz);
  spawn('smoke', row.x, row.y + 0.5, row.z, 0, 0, 0);
}
// The ball's box (ze: width = height) at the row's previous position, with the server balls' water test (fluids.js, as fireballs.js and wither-boss-mobs.js use).
const BALL_WIDTH = { fireball: FIREBALL.largeSize, smallFireball: FIREBALL.smallSize, witherSkull: SKULL.size };
export function ballWet(world, row) {
  const w = BALL_WIDTH[row.kind] ?? 0, r = w / 2;
  return !!waterAcceleration(world, entityWaterBox([row.px - r, row.py, row.pz - r, row.px + r, row.py + w, row.pz + r])).wet;
}

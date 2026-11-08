// Unloaded chunks retain their remaining block-update delays in this preview.
// Sorting after a deadline moves keeps both array-backed binary heaps valid and
// keeps equal-time creation order. This is browser continuity, not native TileTicks.
// `active(x, z)` decides which entries run (default: the resident ticking window; fluids.js passes ringBlockTickActive).
export function pauseUnloadedTicks(world, entries, active = (x, z) => world.isTicking(x, z)) {
  if (!world.streaming) return;
  let changed = false;
  for (const e of entries) if (!active(e.x,e.z)) { e.time++; changed = true; }
  if (changed) entries.sort((a,b)=>a.time-b.time || (a.id??0)-(b.id??0));
}
export const entityActive = (world, e) => !world.streaming || world.isTicking(e.x,e.z);
// World.updateEntities updates every loaded entity through updateEntityWithOptionalForce(e, true), which returns unless
// checkChunksExist(floor(x) - 32, 0, floor(z) - 32, floor(x) + 32, 0, floor(z) + 32) (bytecode-read, ring-entities-reference.json):
// with a headless ring (headless-columns.js, World.ringSink) that is the resident ticking window or the ring's 5 x 5 chunk test.
// Used by item entities, experience orbs, arrows, thrown projectiles, falling blocks and primed TNT (natural-spawning.md "Round 6").
export const ringEntityActive = (world, e) => entityActive(world, e) || !!world.ringSink?.active(e.x, e.z);
// WorldServer.tickUpdates runs a due entry when checkChunksExist(x - b0, .., z + b0) with b0 = 0: the entry's own chunk is loaded.
export const ringTickActive = (world, x, z) => entityActive(world, { x, z }) || !!world.ringSink?.holds(x, z);
// Scheduled block ticks of fluids and redstone (natural-spawning.md "Round 7"): the ticking window, or a ring column whose own chunk
// takes writes (tickUpdates' b0 = 0) and whose eight neighbour chunks are held, so that no update reads a missing column as air
// (HeadlessColumns.blockTicks; natively those chunks are loaded).
export const ringBlockTickActive = (world, x, z) => entityActive(world, { x, z }) || !!world.ringSink?.blockTicks(x, z);

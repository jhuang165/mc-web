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
// `reach` (blocks, batch 26): an entry whose update cannot read further than that from its cell needs only the chunks that span it,
// not all eight neighbours (fluids 5: the flow search is 4 deep; fire 4), so it runs up to the rim; without `reach` the eight are needed.
export const ringBlockTickActive = (world, x, z, reach = 0) => entityActive(world, { x, z }) || !!(reach ? world.ringSink?.writable(x, z) && world.ringSink.reaches(x, z, reach) : world.ringSink?.blockTicks(x, z));
// Random block ticks (WorldServer.func_147456_g, natural-spawning.md "Round 8") run natively in every chunk of activeChunkSet, and the
// chunk itself is all a random tick needs to exist. Here a block outside the resident ticking window ticks when its own column takes
// writes (resident halo, or held and hydrated; HeadlessColumns.randomTickChunks) and the chunks within `reach` blocks of it are
// resident or held, so that no update reads a missing column as air (an adaptation: natively those chunks are loaded).
export const ringRandomActive = (world, x, z, reach = 4) => entityActive(world, { x, z }) || (!!world.ringSink?.writable(x, z) && world.ringSink.reaches(x, z, reach));

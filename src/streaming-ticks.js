// Unloaded chunks retain their remaining block-update delays in this preview.
// Sorting after a deadline moves keeps both array-backed binary heaps valid and
// keeps equal-time creation order. This is browser continuity, not native TileTicks.
export function pauseUnloadedTicks(world, entries) {
  if (!world.streaming) return;
  let changed = false;
  for (const e of entries) if (!world.isTicking(e.x,e.z)) { e.time++; changed = true; }
  if (changed) entries.sort((a,b)=>a.time-b.time || (a.id??0)-(b.id??0));
}
export const entityActive = (world, e) => !world.streaming || world.isTicking(e.x,e.z);

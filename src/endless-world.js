// Endless copies of finite Java worlds ("Endless" button on Select World).
//
// A finite Java world (biome java / javaLargeBiomes / javaAmplified) and its endless counterpart
// (javaStreamed) run the same seeded generator chain from the same spawn-biome origin, and the streamed
// first window is the finite 8x8 window (world-types.test.js compares their terrain column by column).
// So a finite save becomes an endless one by rewriting the record: edits keep their local coordinates and
// the saved entities, drops, containers, spawners, carts and ticks carry over unchanged.
//
// What changes is only what lies beyond the old 128x128 area, and population inside it:
//   generation  9 (terrain, caves, ravines)         -> 12, the same terrain-only generator, exact.
//   generation 11 (full population)                 -> 13, per-cell population.
//   generation 14 (population + structures)         -> 15, per-cell population + structures.
// Streamed population is a labelled approximation of the finite order (streaming.md), so the original
// window may differ from the finite save in rare overlaps; the player's edits are replayed over it. The
// original 64 columns are marked as already claimed, so their saved chests, animals and spawners are not
// handed over a second time. Generation 10 (mineshafts only) has no endless equivalent: terrain-only would
// delete its mineshafts and full population would add everything else, so it is refused.
// The conversion always makes a copy; the finite world is left untouched.

export const ENDLESS_TYPES = { java: 'default', javaLargeBiomes: 'largeBiomes', javaAmplified: 'amplified' };
export const ENDLESS_GENERATIONS = { 9: 12, 11: 13, 14: 15 };
// The finite window is chunks 0..7 on both axes: population cell 0,0, every column claimed.
const FIRST_WINDOW = { version: 1, cells: { '0,0': 'ffffffffffffffff' } };

export function canGoEndless(record) {
  return Object.hasOwn(ENDLESS_TYPES, record?.biome) && Object.hasOwn(ENDLESS_GENERATIONS, record?.generationVersion);
}

// A new record that continues `record` as an endless world. `id`, `name` and `folder` are the caller's
// (a fresh UUID and a name/folder not yet on the shelf); the copy shares no object with the original.
export function endlessCopy(record, { id, name, folder, now = Date.now() }) {
  if (!canGoEndless(record)) throw new Error('This world cannot be made endless');
  const copy = structuredClone(record);
  const generationVersion = ENDLESS_GENERATIONS[record.generationVersion];
  Object.assign(copy, {
    id, name, folder,
    biome: 'javaStreamed', worldType: ENDLESS_TYPES[record.biome], generationVersion,
    updated: now,
  });
  if (generationVersion >= 13) copy.populatedColumns = structuredClone(FIRST_WINDOW);
  else delete copy.populatedColumns;
  return copy;
}

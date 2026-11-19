// Batch 85 mpperf85: fewer allocations in the tracker and the mob target list (results unchanged). MC_MPPERF85=on (default) | off (reference paths) | verify (both,
// throws on the first difference); tests set `fast85.mode`. This module imports nothing.
//   1. entity-tracker.js stepEntry: the mob's size is written into a scratch (`sizeOf.into`, set by server-mobs.js track) and the observe() record is not built
//      (airBorne and the changed flag are read in place).
//   2. entity-tracker.js sendLocation -> copy-meta.js copyMetaDiff: the diff against the last sent watched values without building copyMetaOf's record for every mob every tick.
//   3. server-mob-entries.js serverStep: the live-mob test is a per-entry tick stamp instead of a Set of every mob, and a mob that already has an entry is not sized.
//      SharedEntry.emit shares one destination array while the watcher set is unchanged.
//   4. server-mobs.js track: the tick's state strings are not memoised in a Map (stateDiffs asks for each entry once, a spawn packet is the rare second ask; the
//      string is a pure function of the mob), and the size closure is made once.
//   5. projectiles.js mobTargets: the callback returns the `{ ref, box }` record itself (mobTargetList accepts a non-array), no one-element list per mob.
export const fast85 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF85) || "on" };
export const fail85 = (what) => { throw new Error(`mpperf85 ${what} mismatch`); };
export const SIZE_SCRATCH = [0, 0];

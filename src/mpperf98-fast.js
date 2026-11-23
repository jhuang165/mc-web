// Batch 98 mpperf98: server tick allocation (results unchanged). MC_MPPERF98=on (default) | off (the b97 code) | verify (both where a comparison is cheap, throws on a difference); tests set `fast98.mode`.
// Attribution (heap sampling, travel, 150 ticks, 247 MB): movePlayer self 5.0 MB (three Object.assign calls with a fresh literal each),
// the beacon `players: [...].map` literal list built every tick although tickBeacons returns before reading it except every 80th tick with a beacon, deliverSounds' `splice(0)` copy.
//   1. movePlayer copies the three fields straight into previous / position / velocity (Object.assign of a literal does the same stores); the inLava box is built inline.
//   2. the beacon player list is built only when tickBeacons would read it (a beacon exists and ticks % 80 === 0); otherwise it gets the empty list it never looks at.
//   3. deliverSounds returns at once on an empty queue and walks a non-empty one by index (same sounds, same order) instead of splice(0)'s copy.
// This module imports nothing.
export const fast98 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF98) || "on" };
export const fail98 = (what) => { throw new Error(`mpperf98 ${what} mismatch`); };

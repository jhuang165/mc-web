// Batch 99 mpperf99: server tick allocation (results unchanged). MC_MPPERF99=on (default) | off (the b98 code) | verify (both where a comparison is cheap, throws on a difference); tests set `fast99.mode`.
// Attribution (heap sampling, travel, 150 ticks, 249 MB): the player list handed to tickSpawners was built every tick in both dimensions' callers although tickSpawners returns before reading it
// when no spawner exists; ChunkSet.chunks built a centres array of pairs and a key string on every call just to find the answer unchanged; deliverSounds opened a Map iterator per queued sound.
//   1. tickSpawners takes `players` as a function too; the callers pass one and it runs only after the early return.
//   2. ChunkSet.chunks compares the players' chunk numbers with the last call's flat list (and radius, size, origin) before building pairs and the key.
//   3. deliverSounds copies the players into one array per call (same order) instead of one Map iterator per sound.
// This module imports nothing.
export const fast99 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF99) || "on" };
export const fail99 = (what) => { throw new Error(`mpperf99 ${what} mismatch`); };

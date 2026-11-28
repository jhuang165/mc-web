// Batch 102 mpperf102: server tick allocation (results unchanged). MC_MPPERF102=on (default) | off (the b101 code) | verify (both where a comparison is cheap, throws on a difference); tests set `fast102.mode`.
// This module imports nothing.
export const fast102 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF102) || "on" };
export const fail102 = (what) => { throw new Error(`mpperf102 ${what} mismatch`); };

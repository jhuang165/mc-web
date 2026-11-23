// Batch 97 mpperf97: server tick allocation (results unchanged). MC_MPPERF97=on (default) | off (the b96 code) | verify (both, compared each call, throws on a difference); tests set `fast97.mode`.
// Attribution (heap sampling with stack traces, travel, 150 ticks, 255 MB): simulation.js itemList's map closure 2.1 MB, presence's 1.5 MB (one tick packet each; items and players are walked
// by filter().map() with a closure and an array spread), collisionBoxes' list in moveEntity (blockBoxesFast "self" 6.2 MB: the pushes regrow the backing store, because `list.length = 0`
// on a 17-slot array frees it). This module imports nothing.
//   1. the item and player lists of the tick packet are built by one index loop (same elements, same order, same objects' keys).
//   2. `resetList97`: the scratch list is emptied by pops. `list.length = 0` hands the backing store back every time (152 bytes regrown by the next push); pops down to 0 keep it (executed
//      micro-measurement: 154 bytes per reset-and-fill cycle with `length = 0`, 4-7 with pops; pre-sizing the array makes no difference).
export const fast97 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF97) || "on" };
export const fail97 = (what) => { throw new Error(`mpperf97 ${what} mismatch`); };
export const smallList97 = () => [];
export function resetList97(s) {
  const l = s.list;
  if (fast97.mode === "off") l.length = 0; else while (l.length > 0) l.pop();
}

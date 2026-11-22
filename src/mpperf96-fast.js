// Batch 96 mpperf96: server tick allocation (results unchanged). MC_MPPERF96=on (default) | off (reference for-of loops) | verify (both, in lock-step, throws on the first
// difference); tests set `fast96.mode`. This module imports nothing.
// Attribution (heap sampling with stack traces, travel, 150 ticks): the `next` frames are 15.2 MB of 259, spread over about 60 call sites (largest 1.6 MB: the watcher / entry
// Map loops of the entity tracker's serverStep). Each `for (const x of map.values())` makes a Map iterator and, in code V8 has not optimised, one {value, done} result per step.
//   1. eachValue96(map | set | array, fn): `fn(value)` in the order and with the live semantics of `for (const v of c)` over a Map's values / Set / array, through forEach (no iterator).
//      Callers convert only loops that do not `continue` out of the caller's own loop, `break` or `return` from the caller.
//   2. Loops over arrays elsewhere (nearbyLate, pickupHits, ai nearby, the portal step, noteMobSpawns, movePlayer's axis pair, chunk ordering) are plain index loops: an array
//      iterator reads `length` at every step, so `for (let i = 0; i < a.length; i++)` visits the same elements in the same order, also when the body pushes. A source change, not a switch.
export const fast96 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF96) || "on" };
export const fail96 = (what) => { throw new Error(`mpperf96 ${what} mismatch`); };

// Map: values (as `map.values()`); Set: members; array: elements. `fn.call(self, value)`: a method-level callback with `self` as `this` needs no closure per call.
export function eachValue96(c, fn, self) {
  const mode = fast96.mode;
  if (mode === "off") { for (const v of c instanceof Map ? c.values() : c) fn.call(self, v); return; }
  if (mode === "verify") {
    const it = c instanceof Map ? c.values() : c[Symbol.iterator]();
    if (Array.isArray(c)) { for (let i = 0; i < c.length; i++) { const r = it.next(); if (r.done || r.value !== c[i]) fail96("array walk"); fn.call(self, c[i]); } }
    else c.forEach((v) => { const r = it.next(); if (r.done || r.value !== v) fail96("walk"); fn.call(self, v); });
    if (!it.next().done) fail96("walk end");
    return;
  }
  if (Array.isArray(c)) { for (let i = 0; i < c.length; i++) fn.call(self, c[i]); return; }
  c.forEach(fn, self); // forEach also passes (key, map): the callbacks take the value only
}

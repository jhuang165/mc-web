// Batch 92 mpperf92: server tick speed (results unchanged). MC_MPPERF92=on (default) | off (reference path) | verify (both, throws on the first difference); tests set `fast92.mode`.
//   1. projectiles.js mobTargets (mobTargetAt92): when a mob has moved, its target box is rewritten in place instead of replaced, but only when the box was last handed out
//      before the current mob tick (entities.js tickMobs calls bumpTargetEpoch92). A box handed out during this very tick may still sit in a list a sweep is walking (a teleport
//      moved the mob between two lists of one tick), so it is replaced as before (b84: "an array handed out is never written to again" stays true within a tick). Every caller
//      builds its list per call and drops it before the next mob tick (audited in the b92 note); a store whose list never ticks (epoch stays 0) never reuses.
//   2. pathfinding.js: Navigator.finder() hands out one shared PathFinder (reset to the state a new one has) instead of building a PathFinder, a 1024-slot heap array, a 32-slot
//      option array and an options object per search; beginMemo keeps its page table (an array of n^3 slots) per size and clears only the slots the search used.
import { targetStore88, mobTargetAt88 } from "./mpperf88-fast.js";
import { carryBoxStore } from "./mpperf84-fast.js";

export const fast92 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF92) || "on" };
export const fail92 = (what) => { throw new Error(`mpperf92 ${what} mismatch`); };

// ---- 1. target boxes ----
// Called once per tickMobs with the mob list: later sweeps may rewrite boxes that were handed out in earlier ticks.
export function bumpTargetEpoch92(st) { if (st !== null && fast92.mode !== "off") targetStore88(st).epoch = (targetStore88(st).epoch | 0) + 1; }
// tickMobs replaces its list by a filtered copy: the target store (boxes, records) goes with it, so it survives from tick to tick.
export function carryTargets92(from, to) { if (fast92.mode !== "off") carryBoxStore(from, to); }
const sameNum = (a, b) => (a === b ? a !== 0 || 1 / a === 1 / b : a !== a && b !== b);
export function mobTargetAt92(s, i, e, t, young) {
  if (fast92.mode === "off") return mobTargetAt88(s, i, e, t, young);
  const f = Math.fround, k = young ? 0.5 : 1, w = f(t.width * k), h = f(t.height * k), hw = f(w / 2), x = e.x, y = e.y, z = e.z, o = i * 5;
  let n = s.num;
  if (o + 5 > n.length) { const m = new Float64Array(Math.max(n.length * 2, o + 5)); m.set(n); s.num = n = m; }
  const ep = s.epoch | 0, held = s.ep ??= [];
  let box = s.box[i], fresh = false;
  const rebox = box === undefined || s.e[i] !== e;
  if (rebox || !(sameNum(n[o], x) && sameNum(n[o + 1], y) && sameNum(n[o + 2], z) && sameNum(n[o + 3], hw) && sameNum(n[o + 4], h))) {
    s.e[i] = e; n[o] = x; n[o + 1] = y; n[o + 2] = z; n[o + 3] = hw; n[o + 4] = h;
    if (rebox || held[i] === undefined || held[i] >= ep) { box = [x - hw, y, z - hw, x + hw, y + h, z + hw]; s.box[i] = box; fresh = true; }
    else { box[0] = x - hw; box[1] = y; box[2] = z - hw; box[3] = x + hw; box[4] = y + h; box[5] = z + hw; }
  }
  held[i] = ep;
  let r = s.rec[i];
  if (r === undefined || r.ref !== e || r.box !== box || r.thrower !== undefined) s.rec[i] = r = { ref: e, box };
  if (fast92.mode === "verify") {
    const ref = [x - hw, y, z - hw, x + hw, y + h, z + hw];
    if (Object.keys(r).length !== 2 || r.ref !== e || box.length !== 6 || ref.some((v, j) => !Object.is(v, box[j]))) fail92("mob target");
  }
  return r;
}

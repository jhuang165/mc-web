// Batch 84 mpperf84: fewer allocations in the server tick (results unchanged). MC_MPPERF84=on (default) | off (reference paths) | verify (both, throws on the first
// difference); tests set `fast84.mode`. This module imports nothing.
//   1. mobBoxAt: projectiles.js mobTargets' per-mob collision box. server-dispense.js targets() ran it for every mob for every ball, potion and arrow sweep, every
//      tick, each time a fresh 6-number array. The box is cached per list slot (a WeakMap lookup per call, not per mob) and reused while the entity and its inputs
//      (x, y, z, half width, height) are unchanged;
//      a change replaces the cached array (an array handed out is never written to again, so a sweep that kept one still reads its own tick's box).
//   2. moveSpeedQuick: entities.js aiMoveSpeed without the six temporary modifier arrays when the mob has no stored modifiers, effects or transient boosts.
//   3. stepBlockInto: step-block.js stepBlock's answer written into a caller scratch object (mob-steps.js reads it at once).
//   (Unflagged: moveEntityBody's and the item move's `for (const o of list)` loops became indexed loops: the same order, no iterator object.)

export const fast84 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF84) || "on" };
const fail = (what) => { throw new Error(`mpperf84 ${what} mismatch`); };
export { fail as fail84 };

// ---- 1. mob target boxes ----
const stores = new WeakMap(); // entities array -> records by list index: { e, x, y, z, hw, h, box }
const freshBox = (x, y, z, hw, h) => [x - hw, y, z - hw, x + hw, y + h, z + hw];
// One store per mob list (a lane's mobs.entities); null when off. A record is valid only for the same entity at the same index with the same inputs, so a list that
// shifted (a mob died or spawned) just misses and rebuilds.
export function boxStore(entities) {
  if (fast84.mode === "off") return null;
  let st = stores.get(entities);
  if (st === undefined) stores.set(entities, (st = []));
  return st;
}
export function mobBoxAt(st, i, e, hw, h) {
  const x = e.x, y = e.y, z = e.z;
  if (st === null) return freshBox(x, y, z, hw, h);
  let c = st[i];
  if (c === undefined || c.e !== e || !(Object.is(c.x, x) && Object.is(c.y, y) && Object.is(c.z, z) && Object.is(c.hw, hw) && Object.is(c.h, h))) {
    // Object.is: 0 and -0 give different boxes, NaN equals itself
    if (c === undefined) st[i] = (c = { e, x, y, z, hw, h, box: null });
    c.e = e; c.x = x; c.y = y; c.z = z; c.hw = hw; c.h = h; c.box = freshBox(x, y, z, hw, h);
  }
  if (fast84.mode === "verify") {
    const ref = freshBox(x, y, z, hw, h);
    for (let k = 0; k < 6; k++) if (!Object.is(ref[k], c.box[k])) fail("mobBoxAt");
  }
  return c.box;
}

// ---- 2. aiMoveSpeed without modifier arrays ----
// `maxSpeed` is ATTRIBUTE_RANGE["generic.movementSpeed"][1]. Returns the attribute value (before the multiplier and the float cast), or undefined when the mob
// has anything the reference path folds in (stored modifiers, effects, baby / boost / drink / sprint flags).
export function moveSpeedQuick(e, base, maxSpeed) {
  const t = e.type;
  if (e.modifiers?.length || e.effects?.length) return undefined;
  if (((t === "zombie" || t === "pigman") && e.growingAge < 0) || (t === "enderman" && e.speedBoost) || (t === "pigman" && e.pigTarget) || (t === "witch" && e.drinking) || (t === "ocelot" && e.sprinting)) return undefined;
  const b = e.attributeBases?.["generic.movementSpeed"] ?? base();
  return Math.min(maxSpeed, Math.max(0, b));
}

// ---- 3. stepBlock's answer in a scratch object: step-block.js stepBlockInto (it imports this module's mode) ----

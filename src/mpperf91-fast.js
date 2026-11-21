// Batch 91 mpperf91: server tick speed (results unchanged). MC_MPPERF91=on (default) | off (reference path) | verify (both, throws on the first difference); tests set `fast91.mode`.
//   1. The S20 change test (SharedEntry.sendAttributes in multiplayer/server-mob-entries.js): a plain mob (no stored modifiers, effects, saved bases, horse record or bumps, a type whose
//      health and speed come straight from the type table) is compared by its three numbers against the ones its last pass saw, so a pass that finds nothing changed builds no rows,
//      modifier arrays or key strings (watchedAttributes, moveSpeedModifiers and rowKey are the allocators it skips). Any change, or any mob that is not plain, takes the old path.
import { ENTITY_TYPES } from "./entities.js";
import { OWN_MAX_HEALTH } from "./mob-riding.js";

export const fast91 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF91) || "on" };
export const fail91 = (what) => { throw new Error(`mpperf91 ${what} mismatch`); };
const MAX = Number.MAX_VALUE;

// The numbers of a plain mob's two watched rows into `q` ({ t, hb, sb, sv }: the type, the max health base (= value), the speed base and the speed value), or false when the mob
// is not plain. Matches watchedAttributes for such a mob: maxHealthOf returns the record's own positive maximum or the type's, movementSpeed is the type's base clamped to 0..MAX.
export function plainAttrs91(e, q) {
  const t = ENTITY_TYPES[e.type], ty = e.type;
  if (t === undefined || ty === "ender_crystal" || OWN_MAX_HEALTH.has(ty)) return false;
  if (e.modifiers?.length || e.effects?.length || e.attributeBases !== undefined || e.horse !== undefined || e.attrBumps !== undefined) return false;
  if (((ty === "zombie" || ty === "pigman") && e.growingAge < 0) || (ty === "enderman" && e.speedBoost) || (ty === "pigman" && e.pigTarget) || (ty === "witch" && e.drinking) || (ty === "ocelot" && e.sprinting)) return false;
  const own = e.maxHealth;
  q.t = ty; q.hb = Number.isFinite(own) && own > 0 ? own : t.health; q.sb = t.movement; q.sv = Math.min(MAX, Math.max(0, t.movement));
  return true;
}
export const newQuick91 = () => ({ t: "", hb: NaN, sb: NaN, sv: NaN });
// true when the mob is plain and its numbers equal `last` (a pass that follows a recorded one: nothing changed).
export function sameAttrs91(e, last, scratch) {
  if (last.hb !== last.hb || !plainAttrs91(e, scratch)) return false;
  return scratch.t === last.t && scratch.hb === last.hb && scratch.sb === last.sb && scratch.sv === last.sv;
}
// After an old-path pass: record the numbers when the mob is plain (else poison `last` so the next pass takes the old path). verify: they equal the rows'.
export function noteAttrs91(e, rows, last) {
  if (fast91.mode === "off" || !plainAttrs91(e, last)) { last.hb = NaN; return; }
  if (fast91.mode === "verify") {
    const h = rows[0], s = rows[1];
    if (rows.length !== 2 || h.name !== "generic.maxHealth" || s.name !== "generic.movementSpeed" || h.mods.length || s.mods.length
      || !Object.is(h.base, last.hb) || !Object.is(h.value, last.hb) || !Object.is(s.base, last.sb) || !Object.is(s.value, last.sv)) fail91("watched rows");
  }
}

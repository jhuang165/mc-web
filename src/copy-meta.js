// Batch 61: the data watcher values a client copy reads for its own draws, and what the copy does with them. They reach the copy in S1C (and S0F at the spawn) like the
// horse's flags and the squid's air: the tracker (entity-tracker.js stepEntry / watched) asks `copyMetaDiff(entry, live)` and sends `{ type: "meta", ...changed }`.
//  - air (watcher 1, every mob but the squid, which sends its own): the server's value; the copy keeps counting from it (copy-water.js).
//  - screaming (watcher 18, enderman): EntityEnderman.onLivingUpdate's `isScreaming && !isAggressive && nextInt(100) == 0` on the copy clears the copy's own flag; the server's
//    flag is untouched and not resent, so the copy follows the packets, not the live flag (executed: MobCopies2Probe `scream`: nextInt(100) each tick until a hit, then none).
//  - invul (watcher 20) and health (watcher 6), wither: the spawn charge's three "mobSpell" per tick and the armour's world-Random roll (xc.e, executed `wither`).
//  - burning (watcher 0 bit 0, every mob; batch 63): Entity.isBurning on a client is `!isImmuneToFire && getFlag(0)` (the copy's own `fire` is zeroed every update). Only the enderman's
//    `isWet() || isBurning()` teleport reads it (copy-teleport.js); the flames still draw from the live mob.
//  - potion (watcher 7, the colour of the active effects, 0 = none) and invisible (watcher 0 bit 5): EntityLivingBase.updatePotionEffects' swirl draws on both sides (executed
//    `potion`: nextBoolean, nextInt(5) when ambient or nextInt(15) when invisible, then three nextDouble on a hit; they follow the air and precede the living roll).
// All draws only: the positions of the copy's particles are not made (the live path shows the visible ones).
import { JavaRandom } from "./java-random.js";
import { potionColor, potionParticles } from "./fx.js";
import { isInvisible } from "./mob-effects.js";
import { deathRandom } from "./death-fx.js";
import { fast85, fail85 } from "./mpperf85-fast.js"; // b85 mpperf85

const NO_FX = { spawn() {} };
// The client world's own Random (World.rand, ahb.s), one for the single client world: the wither's armour roll draws on it.
export const clientWorld = { rand: null };
export const clientWorldRandom = () => (clientWorld.rand ??= new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48))));

// b91 mobpackets91: watcher 8 (EntityLivingBase.updatePotionEffects): 1 when PotionHelper.func_82817_b (aen.b) finds every effect ambient, 0 with no effects (bytecode-read sv.bo).
const allAmbient = (e) => !!e.effects?.length && e.effects.every((x) => x.ambient === true);
// The watched values of the live mob `e` (null for an entity that is not a living mob).
export function copyMetaOf(e) {
  if (typeof e.health !== "number" || !e.type) return null;
  const m = { potion: e.effects?.length ? potionColor(e.effects) : 0, ambient: allAmbient(e), invisible: e.effects?.length ? isInvisible(e) : false };
  m.burning = e.fire > 0; // batch 63: Entity.onEntityUpdate `setFlag(0, fire > 0)` on the server (bytecode-read); the copy reads it through isBurning (`isRemote && getFlag(0)`)
  if (e.type !== "squid") m.air = e.air ?? 300;
  if (e.type === "enderman") m.screaming = !!e.screaming;
  if (e.type === "wither") { m.invul = e.invul ?? 0; m.health = e.health; }
  return m;
}
// The fields of copyMetaOf that differ from `last` (an earlier copyMetaOf), or null; `last` is updated.
export function copyMetaDiffReference(last, e) {
  const now = copyMetaOf(e);
  if (!now) return null;
  let out = null;
  for (const k in now) if (last[k] !== now[k]) { (out ??= {})[k] = last[k] = now[k]; }
  return out;
}
// b85 mpperf85: the same comparison in copyMetaOf's key order (potion, ambient, invisible, burning, air, screaming, invul, health) without the record of the current values.
function copyMetaDiffFast(last, e) {
  if (typeof e.health !== "number" || !e.type) return null;
  let out = null;
  const fx = e.effects?.length, t = e.type;
  const potion = fx ? potionColor(e.effects) : 0;
  if (last.potion !== potion) (out ??= {}).potion = last.potion = potion;
  const ambient = fx ? allAmbient(e) : false;
  if (last.ambient !== ambient) (out ??= {}).ambient = last.ambient = ambient;
  const invisible = fx ? isInvisible(e) : false;
  if (last.invisible !== invisible) (out ??= {}).invisible = last.invisible = invisible;
  const burning = e.fire > 0;
  if (last.burning !== burning) (out ??= {}).burning = last.burning = burning;
  if (t !== "squid") { const air = e.air ?? 300; if (last.air !== air) (out ??= {}).air = last.air = air; }
  if (t === "enderman") { const screaming = !!e.screaming; if (last.screaming !== screaming) (out ??= {}).screaming = last.screaming = screaming; }
  if (t === "wither") {
    const invul = e.invul ?? 0; if (last.invul !== invul) (out ??= {}).invul = last.invul = invul;
    if (last.health !== e.health) (out ??= {}).health = last.health = e.health;
  }
  return out;
}
// b91 mobpackets91: DataWatcher.hasChanges (the third term of my.a(List)'s gate, `ticks % frequency == 0 || isAirBorne || hasChanges`, bytecode-read; executed in
// mobpackets91-reference.json: a Speed add sends S1C, S20, S19 and S12 in a tick that is not a frequency tick): true when copyMetaDiff would send something. Reads only.
export function copyMetaDirty(last, e) {
  if (!last || typeof e.health !== "number" || !e.type) return false;
  const fx = e.effects?.length, t = e.type;
  if (last.potion !== (fx ? potionColor(e.effects) : 0)) return true;
  if (last.ambient !== (fx ? allAmbient(e) : false)) return true;
  if (last.invisible !== (fx ? isInvisible(e) : false)) return true;
  if (last.burning !== (e.fire > 0)) return true;
  if (t !== "squid" && last.air !== (e.air ?? 300)) return true;
  if (t === "enderman" && last.screaming !== !!e.screaming) return true;
  if (t === "wither" && (last.invul !== (e.invul ?? 0) || last.health !== e.health)) return true;
  return false;
}
export function copyMetaDiff(last, e) {
  const mode = fast85.mode;
  if (mode === "off") return copyMetaDiffReference(last, e);
  if (mode !== "verify") return copyMetaDiffFast(last, e);
  const l2 = { ...last }, ref = copyMetaDiffReference(l2, e), got = copyMetaDiffFast(last, e);
  const ka = Object.keys(l2), kb = Object.keys(last);
  if ((ref === null) !== (got === null) || ka.length !== kb.length || ka.some((k, i) => k !== kb[i] || !Object.is(l2[k], last[k]))) fail85("copyMetaDiff last");
  if (ref) { const ra = Object.keys(ref), rb = Object.keys(got); if (ra.length !== rb.length || ra.some((k, i) => k !== rb[i] || !Object.is(ref[k], got[k]))) fail85("copyMetaDiff"); }
  return got;
}
// What S1C / S0F set on the copy.
export function applyCopyMeta(c, p) {
  if (p.screaming !== undefined) c.screaming = !!p.screaming;
  if (p.invul !== undefined) c.invul = p.invul;
  if (p.potion !== undefined) c.potion = p.potion;
  if (p.burning !== undefined) c.burning = !!p.burning;
  if (p.invisible !== undefined) c.invisible = !!p.invisible;
  if (p.ambient !== undefined) c.potionAmbient = !!p.ambient;
}

// updatePotionEffects' swirl on the copy (watcher 7 above 0): potionParticles draws. Skipped for a copy with no potion colour.
export function copyPotionSwirl(c, rand = null) {
  if (!(c.potion > 0)) return;
  potionParticles(NO_FX, { x: c.x, y: c.y, z: c.z, yOffset: 0, width: c.width, height: c.height }, c.potion, rand ?? deathRandom(c), { ambient: !!c.potionAmbient, invisible: !!c.invisible });
}

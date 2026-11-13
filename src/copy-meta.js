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

const NO_FX = { spawn() {} };
// The client world's own Random (World.rand, ahb.s), one for the single client world: the wither's armour roll draws on it.
export const clientWorld = { rand: null };
export const clientWorldRandom = () => (clientWorld.rand ??= new JavaRandom(BigInt(Math.floor(Math.random() * 2 ** 48))));

// The watched values of the live mob `e` (null for an entity that is not a living mob).
export function copyMetaOf(e) {
  if (typeof e.health !== "number" || !e.type) return null;
  const m = { potion: e.effects?.length ? potionColor(e.effects) : 0, invisible: e.effects?.length ? isInvisible(e) : false };
  m.burning = e.fire > 0; // batch 63: Entity.onEntityUpdate `setFlag(0, fire > 0)` on the server (bytecode-read); the copy reads it through isBurning (`isRemote && getFlag(0)`)
  if (e.type !== "squid") m.air = e.air ?? 300;
  if (e.type === "enderman") m.screaming = !!e.screaming;
  if (e.type === "wither") { m.invul = e.invul ?? 0; m.health = e.health; }
  return m;
}
// The fields of copyMetaOf that differ from `last` (an earlier copyMetaOf), or null; `last` is updated.
export function copyMetaDiff(last, e) {
  const now = copyMetaOf(e);
  if (!now) return null;
  let out = null;
  for (const k in now) if (last[k] !== now[k]) { (out ??= {})[k] = last[k] = now[k]; }
  return out;
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

// Batch 61: Entity.handleHealthUpdate (World.setEntityState) on a client copy: the draws the statuses make on the copy's own Entity.rand (draws only, the live path shows
// the visible particles). Executed: tools/probes/MobCopies2Probe.java `status` (sa.a(byte) on every mob class for statuses 1, 4, 6..22, then 40 ticks for the focus pairs)
// -> public/research/mobcopies2-reference.json, replayed by src/mobcopies2-b61.test.js.
//  - 16 (zombie, zombie pigman: yq.a(byte)): mob.zombie.remedy, two nextFloat (volume 1 + f, pitch f * 0.7 + 0.3). The converting zombie makes no per-tick particle of its own:
//    the swirl comes from its potion colour (copy-meta.js).
//  - 15 (witch): `for (i = 0; i < nextInt(35) + 10; ++i)` re-rolls the bound each pass; each pass draws three nextGaussian (witchMagic around the head).
//  - 6 / 7 (wolf, ocelot, horse: func_70908_e / spawnHorseParticles) and 18 (animals in love): seven "smoke" / "heart" (burst: three gaussians x 0.02, three floats each).
//  - 12 / 13 / 14 (villager): five "heart" / "angryVillager" / "happyVillager" (village-ai.js villagerParticles draws them on the copy's Random through visualRandom).
//  - 8 (wolf): the shake starts (bt = true, bu = bv = 0); its per-tick sound and splash draws are copyWolfShake.
//  - 4 / 11 (iron golem): a sound / the flower arm with no draw. 10 (sheep eat grass), 9, 17, 19..22 and 1: no draw on any mob class (status 20 is the spawner's server call).
import { burst } from "./fx.js";
import { updateWolf } from "./wolf.js";
import { deathRandom } from "./death-fx.js";

const NO_FX = { spawn() {} };
const SEVEN = new Set(["wolf", "ocelot", "horse"]);
const LOVERS = new Set(["pig", "cow", "mooshroom", "sheep", "chicken", "wolf", "ocelot", "horse"]);

// One handleHealthUpdate(status) on the copy `c` of the live mob `m`. Returns true when the status drew something.
export function copyStatus(c, m, status, rand = deathRandom(c)) {
  const box = { x: c.x, y: c.y, z: c.z, width: c.width ?? 0.6, height: c.height ?? 1 };
  if (status === 16 && (m.type === "zombie" || m.type === "pigman")) { rand.nextFloat(); rand.nextFloat(); return true; }
  if (status === 15 && m.type === "witch") {
    for (let i = 0; i < rand.nextInt(35) + 10; i++) { rand.nextGaussian(); rand.nextGaussian(); rand.nextGaussian(); }
    return true;
  }
  if ((status === 6 || status === 7) && SEVEN.has(m.type)) { burst(NO_FX, status === 7 ? "heart" : "smoke", 7, box, rand, 0.5); return true; }
  if (status === 18 && LOVERS.has(m.type)) { burst(NO_FX, "heart", 7, box, rand, 0.5); return true; }
  if (status >= 12 && status <= 14 && m.type === "villager") { burst(NO_FX, ["heart", "angryVillager", "happyVillager"][status - 12], 5, box, rand, 1); return true; }
  if (status === 8 && m.type === "wolf") { const s = wolfCopy(c); s.shaking = true; s.shakeTime = 0; s.prevShakeTime = 0; return true; }
  return false;
}

// EntityWolf.h on the copy (after the living update): the shake of status 8 or of a copy in water: the sound's two floats at the start, then the splash particles (two floats
// each). The copy's wetness is its own inWater; the server-only start of a shake (a wet wolf standing still) is status 8, so hasPath is false on a client (no path is ever set there).
const wolfCopy = (c) => (c.wolf ??= { wet: false, shaking: false, shakeTime: 0, prevShakeTime: 0, headTilt: 0, prevHeadTilt: 0, begging: false, health: 0, idle: 0 });
export function copyWolfShake(c, m, rand = deathRandom(c)) {
  if (m.type !== "wolf") return;
  const s = wolfCopy(c);
  if (!s.wet && !s.shaking && !c.inWater) return;
  const out = updateWolf(s, { inWater: !!c.inWater, onGround: !!c.onGround, hasPath: false, rand });
  if (out.shakeSound) { rand.nextFloat(); rand.nextFloat(); }
  for (let i = 0; i < out.splashes; i++) { rand.nextFloat(); rand.nextFloat(); }
}

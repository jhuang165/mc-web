// Batch 60: the Random stream of a client copy of an EntityLiving (the Entity.rand of the copy, unseeded in Java), so it is aligned with the native stream when the copy dies
// (the death poofs, death-fx.js, draw from the same Random). Executed: tools/probes/MobSoundsProbe.java -> public/research/mobsounds-reference.json (the unchanged mob classes on
// a client world double, alive, 400 ticks each, `update` = EntityLiving.onEntityUpdate and `full` = onUpdate with onLivingUpdate); replayed by src/mobsounds-b60.test.js.
//  - onEntityUpdate: every living copy draws rand.nextInt(1000) < livingSoundTime++ (a hit sets livingSoundTime = -getTalkInterval(): 120 for EntityAnimal / EntityGolem / EntityWaterMob,
//    80 for the rest), then playLivingSound: nothing for a creeper, giant, slime and magma cube (no living sound); a wolf's getLivingSound draws nextInt(3) first (not when angry), a tamed
//    ocelot's nextInt(4) (not when in love), a bat's nextInt(4) while hanging; then getSoundPitch's two nextFloat (the ocelot's wild "" and the golems' "none" are still played). A dead
//    copy draws no roll. The sound itself is silent on the client (RenderGlobal.playSound is empty in 1.7.10).
//  - onLivingUpdate (also on a dead copy until it is removed): the enderman spawns two "portal" particles (12 nextDouble), the blaze rolls nextInt(24) (a hit: two floats for the
//    crackle) and spawns two "largesmoke" (6 nextDouble), the wither spawns "smoke" for its three heads (9 nextGaussian), a screaming enderman copy rolls nextInt(100) to calm down. The slime and magma cube landing (onUpdate after
//    onLivingUpdate) spawns size * 8 particles (2 nextFloat each) and a land sound (two floats, magma cube always, slime above size 2).
// The positions of those particles are not made: the live path already shows the visible ones; only the draws matter here.
import { deathRandom } from "./death-fx.js";
import { wolfSay } from "./wolf.js";
import { ocelotSay } from "./ocelot.js";
import { batLivingSound } from "./squid-bat.js";
import { slimeMakesLandSound } from "./slime.js";
import { headParticleSpecs } from "./wither-boss.js";
import { clientWorldRandom } from "./copy-meta.js";
import { copyWetTeleport, copyRainWet } from "./copy-teleport.js";

const SLOW_TALKERS = new Set(["pig", "cow", "mooshroom", "sheep", "chicken", "wolf", "ocelot", "snow_golem", "iron_golem", "squid"]);
export const talkInterval = (type) => (SLOW_TALKERS.has(type) ? 120 : type === "horse" ? 400 : 80);
const SILENT = new Set(["creeper", "giant", "slime", "magma_cube"]); // getLivingSound is null: the roll resets the time but nothing else is drawn
const NO_COPY_ROLL = new Set(["horse", "squid", "ender_dragon", "ender_crystal"]); // horse-copy.js, entities.js clientEnvironment and entity-tracker.js dragonUpdate make their own

// EntityLiving.onEntityUpdate on the copy `c` of the live mob `m`: the roll and the living sound's draws. Returns true on a roll hit.
export function copyLivingRoll(c, m, rand = deathRandom(c)) {
  if (NO_COPY_ROLL.has(m.type) || c.dead || c.deathDone) return false;
  const time = c.livingSoundTime ?? 0;
  c.livingSoundTime = time + 1;
  if (rand.nextInt(1000) >= time) return false;
  c.livingSoundTime = -talkInterval(m.type);
  if (SILENT.has(m.type)) return true;
  if (m.type === "wolf") wolfSay(m, rand);
  else if (m.type === "ocelot") ocelotSay(m, rand);
  else if (m.type === "bat" && !batLivingSound(!!c.batHanging, rand)) return true;
  rand.nextFloat(); rand.nextFloat(); // getSoundPitch
  return true;
}

// Batch 61: the part of onLivingUpdate that runs BEFORE its super call (the move): the enderman's portal particles and scream roll (ya.e: bytecode-read, `super` at the end) and
// the blaze's sound roll and smoke. A splash inside the move (copy-water.js) therefore follows these draws (executed: MobCopies2Probe `water`, Enderman).
export function copyLivingPre(c, m, rand = deathRandom(c), world = null, boatBoxes = null, rained = null) {
  if (c.gone) return;
  switch (m.type) {
    case "enderman":
      for (let i = 0; i < 12; i++) rand.nextDouble();
      // batch 62 (copy-teleport.js): isWet() -> teleportRandomly, before the scream roll (executed: MobCopies2Probe `watertp`); batch 63: or isBurning() (the copy's watcher 0 flag, executed `burntp`);
      // the branch clears the copy's scream flag first (executed `wetscream`); batch 64: isWet() also counts rain (`rained`, the client world's canLightningStrikeAt; executed `rainfeet` `rainhead` `raindry`); `boatBoxes` are the other entities' boxes of the destination test
      if (world && (c.inWater || c.burning || (rained && copyRainWet(c, rained)))) { c.screaming = false; copyWetTeleport(c, world, rand, boatBoxes); }
      // ya.e: `isScreaming() && !isAggressive() && nextInt(100) == 0` clears the copy's watcher 18; the client's isAggressive is never set (server AI only).
      // The copy's flag is the one S1C / S0F gave it (copy-meta.js), not the live one: the server's flag is not resent when the copy clears its own.
      if (c.screaming && rand.nextInt(100) === 0) c.screaming = false;
      break;
    case "blaze":
      if (rand.nextInt(24) === 0) { rand.nextFloat(); rand.nextFloat(); }
      for (let i = 0; i < 6; i++) rand.nextDouble();
      break;
    default:
  }
}

// The draws of onLivingUpdate (the wither's, after its move) and the slime's onUpdate tail on the copy, after the move (the enderman's and the blaze's are copyLivingPre). Skipped once the copy has been removed (deathDone before this tick).
export function copyLivingUpdate(c, m, rand = deathRandom(c)) {
  if (c.gone) return;
  switch (m.type) {
    case "wither": // xc.e's tail on the copy: the head smoke, the armour roll on the client world's Random (health from watcher 6), the charge's "mobSpell" (watcher 20)
      headParticleSpecs({ x: c.x, y: c.y, z: c.z, renderYawOffset: c.renderYawOffset, rotationYaw: c.rotationYaw, health: c.health ?? m.health, invul: c.invul ?? 0 }, rand, clientWorldRandom());
      break;
    case "slime": case "magma_cube": {
      const landed = c.onGround && !c.slimeWasOnGround;
      c.slimeWasOnGround = c.onGround;
      if (!landed) break;
      for (let i = 0; i < (m.size ?? 1) * 16; i++) rand.nextFloat();
      if (m.type === "magma_cube" || slimeMakesLandSound(m.size ?? 1)) { rand.nextFloat(); rand.nextFloat(); }
      break;
    }
    default:
  }
}

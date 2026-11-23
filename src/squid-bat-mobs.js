// EntitySquid and EntityBat inside EntityWorld (entities.js): the per-tick update, the living sound and the hurt wrapper; natural spawning is
// SpawnerAnimals (spawner-animals.js). The pure rules are in squid-bat.js (replayed against public/research/squid-bat-reference.json); this file only wires them to the
// engine's mob record, motion and event queue. entities.js calls squidBatUpdate, squidBatTalk and installSquidBat.
import { moveEntity, entityRandom, livingSoundRoll } from "./entities.js";
import { normalCube } from "./world.js";
import { squidCorpse } from "./corpse-living.js";
import {
  SQUID, BAT, BAT_SOUNDS, BAT_TAKEOFF_VOLUME, squidStateOf, batStateOf, squidActionState, squidLivingUpdate, squidAir, squidWet, legacyBodyTurn,
  batAIStep, batUpdate, batLivingSound, batSoundPitch, batHurt,
} from "./squid-bat.js";
const f = Math.fround;
export const isSquidOrBat = (e) => e.type === "squid" || e.type === "bat";

// EntityLiving.onEntityUpdate's roll with the type's talk interval (EntityWaterMob 120, EntityLiving 80); the squid has no living sound, the
// bat's is silent three times in four while hanging (we.t) and plays at volume 0.1, pitch times 0.95.
export function squidBatTalk(m, e) {
  const rand = entityRandom(e);
  if (!livingSoundRoll(e, rand, e.type === "squid" ? SQUID.talkInterval : 80) || e.type === "squid") return;
  const sound = batLivingSound(!!e.batHanging, rand);
  if (sound) m.events.push({ sound, volume: BAT.volume, pitch: batSoundPitch(rand), position: { x: e.x, y: e.y, z: e.z } });
}

// The rest of the tick for a living squid or bat, after the air and the living-sound roll (the caller `continue`s afterwards).
export function squidBatUpdate(m, e, t) {
  if (e.type === "squid") squidUpdate(m, e, t);
  else batTick(m, e, t);
}

// EntityWaterMob.onEntityUpdate's air and EntitySquid.onLivingUpdate. ws.M() (handleMaterialAcceleration) runs twice a tick, in the air
// check and in onLivingUpdate; each call adds the flow push to the motion (bytecode-derived, not probed).
function squidUpdate(m, e, t) {
  const rand = entityRandom(e), s = squidStateOf(e, rand), wetNow = () => {
    const r = squidWet(m.world, e);
    e.vx += r.push[0];
    e.vy += r.push[1];
    e.vz += r.push[2];
    return r.wet;
  };
  if (squidAir(e, { wet: wetNow() })) {
    m.hazard(e, SQUID.drownDamage, "drown");
    // b93 mobrec93 (executed b93mr-squid-dry-9505): the drowning kill happens in onEntityUpdate; ws.e() (onLivingUpdate) still runs this tick as a corpse (movement blocked: the move, the push and the tentacle tail, no action state).
    if (e.health <= 0) { squidCorpse(m, e, t); return; }
  }
  // EntityLivingBase.onLivingUpdate: motion below 0.005 snaps to 0, then updateEntityActionState (ws.bq) with its despawnEntity.
  if (Math.abs(e.vx) < 0.005) e.vx = 0;
  if (Math.abs(e.vy) < 0.005) e.vy = 0;
  if (Math.abs(e.vz) < 0.005) e.vz = 0;
  e.idle = e.idle || 0;
  s.age = e.idle;
  squidActionState(s, { rand, inWater: !!e.inWater });
  e.idle = s.age;
  m.ai.brain(e).despawnEntity();
  e.rotationYawHead = e.rotationYaw; // EntityLivingBase.onLivingUpdate (sv.e) sets rotationYawHead = rotationYaw after the action state, before ws.e's own yaw turn (b93 mobrec93, executed b93mr-squid-swim: the head yaw follows the body yaw one tick late)
  if (e.health <= 0) return;
  // ws.e(FF): moveEntity(motion) with no gravity, friction or acceleration.
  const hooks = m.moveHooks(e, t); // b83 rain83: the shared mob hooks (isWet: water or rain, the fizz) in place of wet: false
  const landed = moveEntity(m.world, e, t.width, t.height, e.vx, e.vy, e.vz, undefined, hooks);
  if (landed > 0) {
    m.onLand?.(e, landed);
    m.fall(e, landed);
  }
  m.push(e, t); // b84 mobs84: sv.e's collideWithNearbyEntities (sv.bo) comes after the move and before ws.e's tail, as in corpse-living.js squidCorpse
  squidLivingUpdate(s, e, { rand, wet: wetNow() });
  legacyBodyTurn(e, e.x - e.px, e.z - e.pz);
  e.yaw = (-e.rotationYaw * Math.PI) / 180;
}

// EntityBat.updateAITasks (we.bn) on top of EntityLiving's (the AI is empty; the move and look helpers still run), then we.h's tail.
function batTick(m, e, t) {
  const s = batStateOf(e), rand = entityRandom(e), world = m.world, brain = m.ai.brain(e), pr = m.random;
  const ctx = {
    rand,
    get playerNear() { return !!m.ai.closestPlayer(brain, 4); },
    normalCube: (x, y, z) => normalCube(world.get(x, y, z)),
    isAir: (x, y, z) => world.get(x, y, z) === 0,
    // RenderGlobal.playAuxSFX 1015: mob.bat.takeoff at 0.05, (rand - rand) * 0.2 + 1, from the block's centre.
    takeoff: (x, y, z) => m.events.push({ sound: BAT_SOUNDS.takeoff, volume: BAT_TAKEOFF_VOLUME, pitch: f(f(f(pr() - pr()) * f(0.2)) + 1), position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } }),
  };
  m.walk(e, t, 0, () => {
    m.ai.think(e);
    batAIStep(s, e, ctx);
    e.yaw = (-e.rotationYaw * Math.PI) / 180;
    // b93 mobrec93 (executed b93mr-bat-hit-9513, b93mr-bat-wake-*): we.h's hanging tail assigns posY alone, so the bounding box keeps its old place; Entity.moveEntity then sets
    // posY = box.minY + yOffset - ySize from that stale box. A bat that wakes moves from the box (5.1), not from the hanging y (5.1 - 2.4e-8 for the float height).
    if (s.hangY !== undefined && e.y === s.hangY) e.y = s.boxY;
  });
  s.boxY = e.y; // the box's place after the move (the walk's moveEntity just set posY from it)
  batUpdate(e);
  s.hangY = e.y;
  // b97 mobrec97 (executed b97mr-bat-glass-9714): EntityBat overrides collideWithNearbyEntities (we.bo) and collideWithEntity (we.o) with empty bodies, so a bat pushes
  // nothing and no cart or boat beside it pushes it either; the player's push already skips a bat (EntityBat.canBePushed is false).
  m.turnBody(e);
  m.swingLimbs(e);
}

// Wraps EntityWorld.attackEntityFrom and kill: a hit wakes a hanging bat (we.a(ro, F)) and resets the squid's entityAge
// (EntityLivingBase.attackEntityFrom), the squid's null hurt and death sounds are dropped, and the bat's sounds take getSoundPitch's 0.95.
export function installSquidBat(EntityWorld) {
  const wrap = (name, before) => {
    const base = EntityWorld.prototype[name];
    EntityWorld.prototype[name] = function (e, ...rest) {
      if (!e || !isSquidOrBat(e)) return base.call(this, e, ...rest);
      const events = this.events.length, client = this.clientSounds?.length ?? 0;
      before(e);
      const out = base.call(this, e, ...rest);
      const fix = (list, from) => {
        if (!list) return;
        for (let i = list.length - 1; i >= from; i--) if ("sound" in list[i] && !list[i].sound) list.splice(i, 1); // the squid's null hurt and death sounds
        // b93 mobrec93 (executed b93mr-squid-hit): only the sounds are adjusted; the loot and experience events a kill queued (no `sound`) stay in the queue (the filter dropped them, so a squid or bat killed through attackEntityFrom left no ink sacs).
        for (const x of list.slice(from)) if (x.sound && e.type === "bat" && x.sound.startsWith("mob.bat.")) x.pitch = f(x.pitch * f(0.95));
      };
      fix(this.events, events);
      fix(this.clientSounds, client);
      return out;
    };
  };
  wrap("attackEntityFrom", (e) => { if (e.type === "bat") batHurt(e); else e.idle = 0; });
  wrap("kill", () => {});
}


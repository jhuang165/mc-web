// EntitySquid (ws, extends EntityWaterMob wu) and EntityBat (we, extends EntityAmbientCreature wd) of Minecraft Java 1.7.10: the pure rules.
// Replayed in squid-bat.test.js against public/research/squid-bat-reference.json (tools/probes/SquidBatProbe.java, tools/verify-squid-bat.mjs);
// public/research/squid-bat.md lists what is probed and what is only bytecode-derived. entities.js, ai.js, combat.js and
// squid-bat-renderer.js call into this module. Floats are fround-ed where the original keeps floats.
import { mhSin, mhCos } from "./lighting.js";
import { DYE } from "./world.js";
import { waterAcceleration } from "./fluids.js";

const f = Math.fround;
const PI = f(3.1415927), TWO_PI = f(6.2831855);

export const SQUID = Object.freeze({
  health: 10, width: f(0.95), height: f(0.95), volume: f(0.4), talkInterval: 120, spawnMinY: 45, spawnMaxY: 63,
  air: 300, drownDamage: 2, shadow: 0.7,
});
export const BAT = Object.freeze({ health: 6, width: f(0.5), height: f(0.9), volume: f(0.1), shadow: 0.25, experience: 0 });
// EntityBat (we) sounds (bytecode-derived: t, aT, aU) and RenderGlobal's aux 1015 (takeoff, volume 0.05).
export const BAT_SOUNDS = Object.freeze({ idle: "mob.bat.idle", hurt: "mob.bat.hurt", death: "mob.bat.death", takeoff: "mob.bat.takeoff" });
export const AUX_BAT_TAKEOFF = 1015;
export const BAT_TAKEOFF_VOLUME = f(0.05);
export const INK_SAC = DYE; // ItemDye damage 0 (EntitySquid.func_146068_u returns Items.dye; dropFewItems uses damage 0)

// wrapAngleTo180_float (qh.g)
export function wrapAngle(a) {
  a = f(a % 360);
  if (a >= 180) a = f(a - 360);
  if (a < -180) a = f(a + 360);
  return a;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// EntitySquid
// ---------------------------------------------------------------------------------------------------------------------------------
// The squid's own state (not saved). `rotationVelocity` is rolled by the constructor: 1 / (rand.nextFloat() + 1) * 0.2.
export function squidRotationVelocity(rand) {
  return f(f(f(1) / f(rand.nextFloat() + 1)) * f(0.2));
}
export function squidState(rand) {
  return {
    pitch: 0, prevPitch: 0, yaw: 0, prevYaw: 0, rotation: 0, prevRotation: 0, tentacle: 0, prevTentacle: 0,
    motionSpeed: 0, rotationVelocity: squidRotationVelocity(rand), rotateSpeed: 0, vecX: 0, vecY: 0, vecZ: 0, age: 0,
  };
}
// EntitySquid.updateEntityActionState (ws.bq): entityAge++; past 100 the random vector is zeroed; else, out of water (Entity.inWater),
// with 1 in 50 or with a zero vector, a new one: f = nextFloat * 2 pi, (cos f * 0.2, -0.1 + nextFloat * 0.2, sin f * 0.2).
// Returns true when despawnEntity (ws.bq's last call) should run.
export function squidActionState(s, { rand, inWater }) {
  s.age++;
  if (s.age > 100) s.vecX = s.vecY = s.vecZ = 0;
  else if (rand.nextInt(50) === 0 || !inWater || (s.vecX === 0 && s.vecY === 0 && s.vecZ === 0)) {
    const a = f(f(rand.nextFloat() * PI) * f(2));
    s.vecX = f(mhCos(a) * f(0.2));
    s.vecY = f(f(-0.1) + f(rand.nextFloat() * f(0.2)));
    s.vecZ = f(mhSin(a) * f(0.2));
  }
  return true;
}
// EntitySquid.onLivingUpdate (ws.e), after EntityLiving's (the move): the rotation, tentacle and swim-speed update. `e` carries
// vx, vy, vz (doubles), renderYawOffset and rotationYaw (floats); `wet` is ws.M() (water in the box shrunk by 0.6 top and bottom).
export function squidLivingUpdate(s, e, { rand, wet, remote = false }) {
  s.prevPitch = s.pitch;
  s.prevYaw = s.yaw;
  s.prevRotation = s.rotation;
  s.prevTentacle = s.tentacle;
  s.rotation = f(s.rotation + s.rotationVelocity);
  if (s.rotation > TWO_PI) {
    s.rotation = f(s.rotation - TWO_PI);
    if (rand.nextInt(10) === 0) s.rotationVelocity = squidRotationVelocity(rand);
  }
  if (wet) {
    if (s.rotation < PI) {
      const t = f(s.rotation / PI);
      s.tentacle = f(f(f(mhSin(f(f(t * t) * PI)) * PI) * f(0.25)));
      if (t > 0.75) {
        s.motionSpeed = 1;
        s.rotateSpeed = 1;
      } else s.rotateSpeed = f(s.rotateSpeed * f(0.8));
    } else {
      s.tentacle = 0;
      s.motionSpeed = f(s.motionSpeed * f(0.9));
      s.rotateSpeed = f(s.rotateSpeed * f(0.99));
    }
    if (!remote) {
      e.vx = f(s.vecX * s.motionSpeed);
      e.vy = f(s.vecY * s.motionSpeed);
      e.vz = f(s.vecZ * s.motionSpeed);
    }
    const h = f(Math.sqrt(e.vx * e.vx + e.vz * e.vz));
    e.renderYawOffset = f(e.renderYawOffset + f(f(f(f(-f(Math.atan2(e.vx, e.vz)) * f(180)) / PI) - e.renderYawOffset) * f(0.1)));
    e.rotationYaw = e.renderYawOffset;
    s.yaw = f(s.yaw + f(f(PI * s.rotateSpeed) * f(1.5)));
    s.pitch = f(s.pitch + f(f(f(f(-f(Math.atan2(h, e.vy)) * f(180)) / PI) - s.pitch) * f(0.1)));
  } else {
    s.tentacle = f(f(f(Math.abs(mhSin(s.rotation)) * PI) * f(0.25)));
    if (!remote) {
      e.vx = 0;
      e.vy -= 0.08;
      e.vy *= 0.9800000190734863;
      e.vz = 0;
    }
    s.pitch = f(s.pitch + f(-90 - s.pitch) * 0.02);
  }
}
// EntityWaterMob.onEntityUpdate (wu.C) after EntityLivingBase's: out of water (ws.M) the air drops by 1; at -20 it is set to 0 and
// attackEntityFrom(drown, 2) follows (returns true); in water it is 300. `alive` is isEntityAlive.
export function squidAir(e, { wet, alive = true }) {
  if (alive && !wet) {
    e.air = (e.air ?? SQUID.air) - 1;
    if (e.air === -20) {
      e.air = 0;
      return true;
    }
    return false;
  }
  e.air = SQUID.air;
  return false;
}
// ws.M(): handleMaterialAcceleration on the bounding box expanded by (0, -0.6, 0) (azt.b: minY + 0.6, maxY - 0.6, an inverted box for a
// 0.95 high squid). Returns { wet, push } for the world's water (fluids.js waterAcceleration, the 0.014 flow push).
export function squidWet(world, e) {
  const r = f(SQUID.width / 2);
  return waterAcceleration(world, [e.x - r, e.y + 0.6000000238418579, e.z - r, e.x + r, e.y + SQUID.height - 0.6000000238418579, e.z + r]);
}
// ws.by (getCanSpawnHere): 45 < posY < 63, then EntityWaterMob's check (no entity in the box).
export function squidCanSpawn(posY, noEntityCollision = true) {
  return posY > 45 && posY < 63 && noEntityCollision;
}
// ws.b(Z, I) (dropFewItems): nextInt(3 + looting) + 1 ink sacs, each its own stack of 1.
export function squidDrops(rand, looting = 0) {
  const n = rand.nextInt(3 + looting) + 1, out = [];
  for (let i = 0; i < n; i++) out.push({ id: INK_SAC, count: 1, damage: 0 });
  return out;
}
// EntityWaterMob.getExperiencePoints (wu.e): 1 + world.rand.nextInt(3).
export const squidExperience = (worldRand) => 1 + worldRand.nextInt(3);

// ---------------------------------------------------------------------------------------------------------------------------------
// EntityBat
// ---------------------------------------------------------------------------------------------------------------------------------
export function batState() {
  return { spawnPosition: null };
}
// EntityBat.updateAITasks (we.bn) after EntityLiving's: the hanging branch and the flying branch. `e.batHanging` (the saved flag, datawatcher
// 16 bit 1) is changed here; `ctx` supplies rand, normalCube(x, y, z), isAir(x, y, z), playerNear (a player within 4.0) and takeoff(x, y, z)
// (aux 1015 with the truncated position). e carries x, y, z, vx, vy, vz (doubles), rotationYaw and rotationYawHead (floats).
export function batAIStep(s, e, ctx) {
  const { rand } = ctx, bx = Math.floor(e.x), by = Math.trunc(e.y) + 1, bz = Math.floor(e.z);
  e.moveForward = 0; // wd.bn's EntityMoveHelper.onUpdateMoveHelper calls setMoveForward(0) first (bytecode-derived; the probe record shows it)
  if (e.batHanging) {
    if (!ctx.normalCube(bx, by, bz)) {
      e.batHanging = false;
      ctx.takeoff(Math.trunc(e.x), Math.trunc(e.y), Math.trunc(e.z));
    } else {
      if (rand.nextInt(200) === 0) e.rotationYawHead = rand.nextInt(360);
      if (ctx.playerNear) {
        e.batHanging = false;
        ctx.takeoff(Math.trunc(e.x), Math.trunc(e.y), Math.trunc(e.z));
      }
    }
    return;
  }
  const ix = Math.trunc(e.x), iy = Math.trunc(e.y), iz = Math.trunc(e.z);
  if (s.spawnPosition && (!ctx.isAir(s.spawnPosition[0], s.spawnPosition[1], s.spawnPosition[2]) || s.spawnPosition[1] < 1)) s.spawnPosition = null;
  if (s.spawnPosition === null || rand.nextInt(30) === 0 || distanceSquared(s.spawnPosition, ix, iy, iz) < 4) {
    s.spawnPosition = [ix + rand.nextInt(7) - rand.nextInt(7), iy + rand.nextInt(6) - 2, iz + rand.nextInt(7) - rand.nextInt(7)];
  }
  const dx = s.spawnPosition[0] + 0.5 - e.x, dy = s.spawnPosition[1] + 0.1 - e.y, dz = s.spawnPosition[2] + 0.5 - e.z;
  e.vx += (Math.sign(dx) * 0.5 - e.vx) * 0.10000000149011612;
  e.vy += (Math.sign(dy) * 0.699999988079071 - e.vy) * 0.10000000149011612;
  e.vz += (Math.sign(dz) * 0.5 - e.vz) * 0.10000000149011612;
  const yaw = f(f((Math.atan2(e.vz, e.vx) * 180) / 3.1415927410125732) - f(90)), turn = wrapAngle(f(yaw - e.rotationYaw));
  e.moveForward = f(0.5);
  e.rotationYaw = f(e.rotationYaw + turn);
  if (rand.nextInt(100) === 0 && ctx.normalCube(Math.floor(e.x), Math.trunc(e.y) + 1, Math.floor(e.z))) e.batHanging = true;
}
// ChunkCoordinates.getDistanceSquared (r.e): float arithmetic on the differences.
function distanceSquared(p, x, y, z) {
  const a = f(p[0] - x), b = f(p[1] - y), c = f(p[2] - z);
  return f(f(f(a * a) + f(b * b)) + f(c * c));
}
// The tail of EntityBat.onUpdate (we.h) after Entity's: a hanging bat has no motion and sits at floor(posY) + 1 - height; a flying bat
// keeps 0.6 of its vertical motion.
export function batUpdate(e) {
  if (e.batHanging) {
    e.vx = e.vy = e.vz = 0;
    e.y = Math.floor(e.y) + 1 - BAT.height;
  } else e.vy *= 0.6000000238418579;
}
// we.t (getLivingSound): a hanging bat is silent three times in four.
export const batLivingSound = (hanging, rand) => (hanging && rand.nextInt(4) !== 0 ? null : BAT_SOUNDS.idle);
// we.bg (getSoundPitch): EntityLiving's, times 0.95.
export const batSoundPitch = (rand) => f(f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + f(1)) * f(0.95));
// The date rule of we.by: month 10 from the 20th, or month 11 up to the 3rd, raises the light limit from 4 to 7. `date` is { month (1-12), day }.
export const isHalloween = (date) => (date.month === 10 && date.day >= 20) || (date.month === 11 && date.day <= 3);
export const batSpawnLimit = (date) => (isHalloween(date) ? 7 : 4);
// we.by (getCanSpawnHere): floor(box.minY) >= 63 refuses; outside Halloween nextBoolean() true refuses; light > nextInt(limit) refuses;
// then EntityLiving's `superOk` (box free of entities and blocks, no liquid). The injectable date makes this testable.
export function batCanSpawn({ boxMinY, light, date, rand, superOk = true }) {
  if (Math.floor(boxMinY) >= 63) return false;
  const limit = batSpawnLimit(date);
  if (limit === 4 && rand.nextBoolean()) return false;
  if (light > rand.nextInt(limit)) return false;
  return superOk;
}
// Entity.rotationYawHead rolls and the other saved bat field: BatFlags (a byte, bit 1 = hanging).
export const batFlags = (e) => (e.batHanging ? 1 : 0);
export const batHangingFromFlags = (flags) => (Number(flags) & 1) !== 0;
// EntityBat.attackEntityFrom (we.a(ro, F)): a hit on a hanging bat on the server wakes it (the hit itself follows).
export function batHurt(e) {
  if (e.batHanging) e.batHanging = false;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Legacy (non-AI) body turn: the tail of EntityLivingBase.onUpdate (sv.h) plus sv.f(FF). The squid is not AI-enabled, so it uses
// this rather than the engine's turnBody. dx and dz are this tick's travel.
// ---------------------------------------------------------------------------------------------------------------------------------
export function legacyBodyTurn(e, dx, dz) {
  const d2 = f(dx * dx + dz * dz);
  let target = e.renderYawOffset;
  if (d2 > f(0.0025000002)) target = f(f(f(f(Math.atan2(dz, dx)) * 180) / f(Math.PI)) - 90);
  const a = wrapAngle(f(target - e.renderYawOffset));
  e.renderYawOffset = f(e.renderYawOffset + f(a * f(0.3)));
  let g = wrapAngle(f(e.rotationYaw - e.renderYawOffset));
  if (g < -75) g = -75;
  if (g >= 75) g = 75;
  e.renderYawOffset = f(e.rotationYaw - g);
  if (f(g * g) > 2500) e.renderYawOffset = f(e.renderYawOffset + f(g * f(0.2)));
}

// Per-entity runtime state (not saved), kept off the entity record so the save code never sees it. `rand` rolls a new squid's
// rotationVelocity (the constructor's 1 / (nextFloat + 1) * 0.2); the renderer only peeks.
const squidStates = new WeakMap(), batStates = new WeakMap();
export const squidStateOf = (e, rand) => squidStates.get(e) ?? (rand ? (squidStates.set(e, squidState(rand)), squidStates.get(e)) : null);
export const batStateOf = (e) => batStates.get(e) ?? (batStates.set(e, batState()), batStates.get(e));

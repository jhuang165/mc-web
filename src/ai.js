// Minecraft Java 1.7.10 mob AI: EntityAITasks (uj) with its mutex bits and tick rate,
// the helpers EntityMoveHelper (tv), EntityLookHelper (tu) and EntityJumpHelper (tt),
// EntitySenses (vw), RandomPositionGenerator (vx) and the tasks the five mobs of this
// build use. See public/research/pathfinding.md for the obfuscated names, what is
// ported and what is not. entities.js keeps the data, the physics and the events;
// each mob gets a `Brain` here (kept in a WeakMap, never saved) that owns the
// navigator, the helpers and the two task lists.
import { buildBlazeGhastTasks } from "./blaze-ghast-mobs.js";
import { buildWitherTasks } from "./wither-boss-mobs.js";
import { PathNavigate } from "./pathfinding.js";
import { chickenJockeyDespawns } from "./mob-riding.js";
import { breakDoorClass } from "./zombie-door.js";
import { HEIGHT } from "./world.js";
import { rayTraceBlocks } from "./projectiles.js";
import { BRIGHTNESS } from "./lighting.js";
import { swellShould, swellState, creeperSafeTries } from "./creeper.js";
import { maxSafePointTries } from "./difficulty.js";
import { buildVillagerTasks, updateVillagerAI } from "./villager.js";
import { villageTasks, nearestVillage } from "./village-ai.js";
import { setHomeArea, detachHome } from "./home-area.js";
import { homeFilter, isWithinHome } from "./home-area.js";
import { zombieVillagerTargets } from "./zombie-villager.js";
import { buildWolfTasks } from "./wolf-ai.js";
import { revengeBrain } from "./revenge-target.js";
import { buildSnowGolemTasks } from "./mooshroom-golem-live.js";
import { isTamed as wolfTamed } from "./wolf.js";
import { buildOcelotTasks, makeAvoid } from "./ocelot-ai.js";
import { canDespawn as ocelotCanDespawn } from "./ocelot.js";
import { INVISIBILITY } from "./mob-effects.js";
import { CARROT_ON_A_STICK, controlState, controlShouldExecute, controlStart, controlReset, controlTick } from "./pig-saddle.js";
const f = Math.fround;
const GRASS = 1, TALL_GRASS = 39;
// MathHelper.wrapAngleTo180_float (qh.g).
const wrap = (a) => {
  a = f(a % 360);
  if (a >= 180) a = f(a - 360);
  if (a < -180) a = f(a + 360);
  return a;
};
// EntityMoveHelper.limitAngle (tv.a(FFF)F) and EntityLookHelper.updateRotation
// (tu.a(FFF)F): `old` turned toward `target` by at most `max` degrees.
export function limitAngle(old, target, max) {
  let d = wrap(f(target - old));
  if (d > max) d = max;
  if (d < -max) d = -max;
  return f(old + d);
}
const DEG = 3.1415927410125732; // (double)(float)Math.PI, as the decompiled `180.0D / 3.1415927410125732D`
// Java's Random calls on top of the world's [0, 1) function (tests inject their own).
export class Rand {
  constructor(source) {
    this.source = source;
  }
  nextInt(n) {
    return Math.floor(this.source() * n);
  }
  nextFloat() {
    return f(this.source());
  }
  nextDouble() {
    return this.source();
  }
}

// --- EntityAIBase (ui) and EntityAITasks (uj) ---
export class Task {
  constructor() {
    this.mutex = 0;
  }
  shouldExecute() {
    return false;
  }
  continueExecuting() {
    return this.shouldExecute();
  }
  isInterruptible() {
    return true;
  }
  startExecuting() {}
  resetTask() {}
  updateTask() {}
}
// uj.a(): every `rate` ticks the list looks for tasks to start, stop or keep (a
// running task survives only while canUse and continueExecuting hold); on the other
// ticks running tasks only get their continueExecuting check; then every running
// task is updated. `canUse` is uj.a(uk): a task may run when each higher-or-equal
// priority task that is running shares no mutex bit, and each lower-priority running
// task is interruptible.
export class TaskList {
  constructor() {
    this.entries = [];
    this.running = [];
    this.tickCount = 0;
    this.rate = 3;
  }
  add(priority, action) {
    this.entries.push({ priority, action });
  }
  // EntityAITasks.removeTask: a running task is reset, then dropped.
  remove(action) {
    const entry = this.entries.find((x) => x.action === action);
    if (!entry) return;
    const at = this.running.indexOf(entry);
    if (at >= 0) {
      entry.action.resetTask();
      this.running.splice(at, 1);
    }
    this.entries.splice(this.entries.indexOf(entry), 1);
  }
  canUse(entry) {
    for (const other of this.entries) {
      if (other === entry) continue;
      const on = this.running.includes(other);
      if (entry.priority >= other.priority) {
        if (on && (entry.action.mutex & other.action.mutex) !== 0) return false;
      } else if (on && !other.action.isInterruptible()) return false;
    }
    return true;
  }
  tick() {
    if (this.tickCount++ % this.rate === 0) {
      // uj.a(): startExecuting runs after the whole evaluation pass, so a reset of a
      // lower-priority task cannot clear a target the new task just set.
      const started = [];
      for (const entry of this.entries) {
        if (this.running.includes(entry)) {
          if (this.canUse(entry) && entry.action.continueExecuting()) continue;
          entry.action.resetTask();
          this.running.splice(this.running.indexOf(entry), 1);
        }
        if (this.canUse(entry) && entry.action.shouldExecute()) {
          started.push(entry);
          this.running.push(entry);
        }
      }
      for (const entry of started) entry.action.startExecuting();
    } else
      for (let i = 0; i < this.running.length; ) {
        const entry = this.running[i];
        if (entry.action.continueExecuting()) i++;
        else {
          entry.action.resetTask();
          this.running.splice(i, 1);
        }
      }
    for (const entry of this.running.slice()) entry.action.updateTask();
  }
}

// --- EntityJumpHelper (tt), EntityMoveHelper (tv), EntityLookHelper (tu) ---
export class JumpHelper {
  constructor(mob) {
    this.mob = mob;
    this.isJumping = false;
  }
  setJumping() {
    this.isJumping = true;
  }
  doJump() {
    this.mob.e.jumping = this.isJumping;
    this.isJumping = false;
  }
}
export class MoveHelper {
  constructor(mob) {
    this.mob = mob;
    this.x = mob.x;
    this.y = mob.y;
    this.z = mob.z;
    this.speed = 0;
    this.update = false;
  }
  setMoveTo(x, y, z, speed) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.speed = speed;
    this.update = true;
  }
  // tv.c(): moveForward is zeroed, then a pending target turns the mob (at most 30
  // degrees a tick), sets aiMoveSpeed (and moveForward) and asks for a jump when the
  // target block is higher and within a block horizontally.
  onUpdateMoveHelper() {
    const m = this.mob;
    m.e.moveForward = 0;
    if (!this.update) return;
    this.update = false;
    const floorY = Math.floor(m.y + 0.5), dx = this.x - m.x, dz = this.z - m.z, dy = this.y - floorY;
    if (dx * dx + dz * dz + dy * dy < 2.5e-7) return;
    const yaw = f(f((Math.atan2(dz, dx) * 180) / DEG) - 90);
    m.rotationYaw = limitAngle(m.rotationYaw, yaw, 30);
    m.setAIMoveSpeed(m.attributeSpeed(this.speed));
    if (dy > 0 && dx * dx + dz * dz < 1) m.jumpHelper.setJumping();
  }
}
export class LookHelper {
  constructor(mob) {
    this.mob = mob;
    this.deltaYaw = 0;
    this.deltaPitch = 0;
    this.looking = false;
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }
  setLookPositionWithEntity(target, deltaYaw, deltaPitch) {
    this.setLookPosition(target.x, target.y + target.eyeHeight, target.z, deltaYaw, deltaPitch);
  }
  setLookPosition(x, y, z, deltaYaw, deltaPitch) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.deltaYaw = deltaYaw;
    this.deltaPitch = deltaPitch;
    this.looking = true;
  }
  // tu.a(): pitch resets to 0; a look target turns pitch and head toward it, else the
  // head eases to the body at 10 degrees a tick; with a path the head stays within 75
  // degrees of the body.
  onUpdateLook() {
    const m = this.mob;
    m.rotationPitch = 0;
    if (this.looking) {
      this.looking = false;
      const dx = this.x - m.x, dy = this.y - (m.y + m.eyeHeight), dz = this.z - m.z, flat = Math.sqrt(dx * dx + dz * dz);
      const yaw = f(f((Math.atan2(dz, dx) * 180) / DEG) - 90), pitch = f(-((Math.atan2(dy, flat) * 180) / DEG));
      m.rotationPitch = limitAngle(m.rotationPitch, pitch, this.deltaPitch);
      m.rotationYawHead = limitAngle(m.rotationYawHead, yaw, this.deltaYaw);
    } else m.rotationYawHead = limitAngle(m.rotationYawHead, m.renderYawOffset, 10);
    const d = wrap(f(m.rotationYawHead - m.renderYawOffset));
    if (!m.navigator.noPath()) {
      if (d < -75) m.rotationYawHead = f(m.renderYawOffset - 75);
      if (d > 75) m.rotationYawHead = f(m.renderYawOffset + 75);
    }
  }
}

// --- RandomPositionGenerator.findRandomTarget (vx.a(td, xz, y)) ---
// Ten random offsets in a (2*xz) x (2*yz) x (2*xz) box (nextInt(2n) - n for x, y, z
// in that order); the one with the greatest getBlockPathWeight wins.
export function findRandomTarget(mob, xz, yz) {
  const r = mob.rand, keep = homeFilter(mob.e, xz);
  let found = false, best = f(-99999), bx = 0, by = 0, bz = 0;
  for (let i = 0; i < 10; i++) {
    const dx = r.nextInt(2 * xz) - xz, dy = r.nextInt(2 * yz) - yz, dz = r.nextInt(2 * xz) - xz;
    const x = dx + Math.floor(mob.x), y = dy + Math.floor(mob.y), z = dz + Math.floor(mob.z);
    if (keep && !keep(x, y, z)) continue;
    const w = mob.getBlockPathWeight(x, y, z);
    if (w > best) {
      best = w;
      bx = x;
      by = y;
      bz = z;
      found = true;
    }
  }
  return found ? { x: bx, y: by, z: bz } : null;
}

// --- Tasks ---
// EntityAISwimming (uf), mutex 4.
class Swim extends Task {
  constructor(m) {
    super();
    this.m = m;
    this.mutex = 4;
    m.navigator.setCanSwim(true);
  }
  shouldExecute() {
    return this.m.e.inWater || this.m.e.inLava;
  }
  updateTask() {
    if (this.m.rand.nextFloat() < 0.8) this.m.jumpHelper.setJumping();
  }
}
// EntityAIPanic (uz), mutex 1: needs a revenge target or fire, then runs to a random
// spot 5 blocks around (findRandomTarget(5, 4)) until the path is finished.
class Panic extends Task {
  constructor(m, speed) {
    super();
    this.m = m;
    this.speed = speed;
    this.mutex = 1;
    this.target = null;
  }
  shouldExecute() {
    if (!this.m.e.revenge && !(this.m.e.fire > 0)) return false;
    const v = findRandomTarget(this.m, 5, 4);
    if (!v) return false;
    this.target = v;
    return true;
  }
  startExecuting() {
    this.m.navigator.tryMoveToXYZ(this.target.x, this.target.y, this.target.z, this.speed);
  }
  continueExecuting() {
    return !this.m.navigator.noPath();
  }
}
// EntityAIMate (ua), mutex 3: with love, find the nearest other animal in love of the
// kind within 8 blocks, walk to it, and after 60 ticks within 3 blocks have the baby.
class Mate extends Task {
  constructor(m, speed) {
    super();
    this.m = m;
    this.speed = speed;
    this.mutex = 3;
    this.partner = null;
    this.delay = 0;
  }
  inLove(b) {
    return b.e.love > 0;
  }
  shouldExecute() {
    if (!this.inLove(this.m)) return false;
    this.partner = this.findPartner();
    return !!this.partner;
  }
  continueExecuting() {
    return this.partner.alive && this.inLove(this.partner) && this.delay < 60;
  }
  resetTask() {
    this.partner = null;
    this.delay = 0;
  }
  updateTask() {
    const m = this.m;
    m.lookHelper.setLookPositionWithEntity(this.partner, 10, m.verticalFaceSpeed);
    m.navigator.tryMoveToEntityLiving(this.partner, this.speed);
    if (++this.delay >= 60 && m.distSq(this.partner) < 9) m.ai.spawnBaby(m, this.partner);
  }
  findPartner() {
    let best = null, dist = Number.MAX_VALUE;
    for (const b of this.m.nearby(8, 8, 8, (o) => o.e.type === this.m.e.type))
      if (this.inLove(this.m) && this.inLove(b) && this.m.distSq(b) < dist) {
        dist = this.m.distSq(b);
        best = b;
      }
    return best;
  }
}
// EntityAITempt (vk), mutex 3: a player within 10 holding the item draws the animal;
// it closes to 2.5 blocks, then waits 100 ticks before it is tempted again. Water is
// no longer avoided while it follows.
class Tempt extends Task {
  constructor(m, speed, item) {
    super();
    this.m = m;
    this.speed = speed;
    this.item = item;
    this.mutex = 3;
    this.cooldown = 0;
    this.player = null;
    this.avoidWater = false;
  }
  shouldExecute() {
    if (this.cooldown > 0) {
      this.cooldown--;
      return false;
    }
    const p = this.m.ai.closestPlayer(this.m, 10);
    this.player = p;
    if (!p) return false;
    return p.holds(this.item);
  }
  startExecuting() {
    this.avoidWater = this.m.navigator.getAvoidsWater();
    this.m.navigator.setAvoidsWater(false);
  }
  resetTask() {
    this.player = null;
    this.m.navigator.clearPathEntity();
    this.cooldown = 100;
    this.m.navigator.setAvoidsWater(this.avoidWater);
  }
  updateTask() {
    const m = this.m;
    m.lookHelper.setLookPositionWithEntity(this.player, 30, m.verticalFaceSpeed);
    if (m.distSq(this.player) < 6.25) m.navigator.clearPathEntity();
    else m.navigator.tryMoveToEntityLiving(this.player, this.speed);
  }
}
// EntityAIControlledByPlayer (ub), mutex 7: a player riding a living pig steers it while holding a carrot on a stick
// (or a boost runs); updateTask moves the pig itself, steps up blocks and wears the stick (pig-saddle.js).
class ControlledByPlayer extends Task {
  constructor(m) {
    super();
    this.m = m;
    this.mutex = 7;
    this.t = controlState();
  }
  shouldExecute() {
    const e = this.m.e;
    return controlShouldExecute({ alive: e.health > 0, playerRider: !!e.rider?.player, boosted: this.t.boosted, heldId: this.m.ai.player.held });
  }
  startExecuting() {
    controlStart(this.t);
  }
  resetTask() {
    controlReset(this.t);
  }
  updateTask() {
    const m = this.m, e = m.e, rider = e.rider, deps = m.ai.deps;
    // The pig record carries x, y, z, onGround, inLava, aiMoveSpeed and rotationYaw; the size is the scaled one.
    const pig = { x: e.x, y: e.y, z: e.z, onGround: e.onGround, inLava: e.inLava, aiMoveSpeed: e.aiMoveSpeed, rotationYaw: e.rotationYaw, width: f(m.width), height: f(m.height) };
    let turned = false;
    controlTick(this.t, pig, {
      riderYaw: f(rider.yaw), riderHeight: f(rider.height ?? 1.8), creative: !!m.ai.survival?.creative, world: m.ai.world, rand: deps.entityRandom(e),
      jump: () => m.jumpHelper.setJumping(),
      wear: () => deps.wearHeld?.(1),
      move: (forward) => {
        e.rotationYaw = pig.rotationYaw; // ub turns the pig before it moves
        turned = true;
        deps.moveWithHeading?.(e, forward);
      },
    });
    if (!turned) e.rotationYaw = pig.rotationYaw;
  }
}
// EntityAIFollowParent (uh), mutex 0: a child (age < 0) follows the nearest adult
// of its kind within 8 blocks once it is 3 or more blocks away, until it is closer
// than 3 or farther than 16; the path is renewed every 10 ticks.
class FollowParent extends Task {
  constructor(m, speed) {
    super();
    this.m = m;
    this.speed = speed;
    this.parent = null;
    this.delay = 0;
  }
  shouldExecute() {
    if (this.m.e.growingAge >= 0) return false;
    let best = null, dist = Number.MAX_VALUE;
    for (const b of this.m.nearby(8, 4, 8, (o) => o.e.type === this.m.e.type)) {
      if (b.e.growingAge < 0) continue;
      const d = this.m.distSq(b);
      if (d > dist) continue;
      dist = d;
      best = b;
    }
    if (!best || dist < 9) return false;
    this.parent = best;
    return true;
  }
  continueExecuting() {
    if (!this.parent.alive) return false;
    const d = this.m.distSq(this.parent);
    return !(d < 9 || d > 256);
  }
  startExecuting() {
    this.delay = 0;
  }
  resetTask() {
    this.parent = null;
  }
  updateTask() {
    if (--this.delay > 0) return;
    this.delay = 10;
    this.m.navigator.tryMoveToEntityLiving(this.parent, this.speed);
  }
}
// EntityAIWander (vc), mutex 1: 1 in 120 when the idle age is under 100, to a spot
// from findRandomTarget(10, 7).
class Wander extends Task {
  constructor(m, speed) {
    super();
    this.m = m;
    this.speed = speed;
    this.mutex = 1;
    this.target = null;
  }
  shouldExecute() {
    if ((this.m.e.idle || 0) >= 100) return false;
    if (this.m.rand.nextInt(120) !== 0) return false;
    const v = findRandomTarget(this.m, 10, 7);
    if (!v) return false;
    this.target = v;
    return true;
  }
  continueExecuting() {
    return !this.m.navigator.noPath();
  }
  startExecuting() {
    this.m.navigator.tryMoveToXYZ(this.target.x, this.target.y, this.target.z, this.speed);
  }
}
// EntityAIWatchClosest (un), mutex 2: 2% a tick, the closest player within the range
// (or the attack target), watched for 40 to 79 ticks while within range.
class WatchClosest extends Task {
  constructor(m, range) {
    super();
    this.m = m;
    this.range = f(range);
    this.chance = f(0.02);
    this.mutex = 2;
    this.target = null;
    this.timer = 0;
    this.watched = "player"; // the watched class: "player", or for the villager's tasks "villager" / "living" (EntityLiving)
  }
  shouldExecute() {
    const m = this.m;
    if (m.rand.nextFloat() >= this.chance) return false;
    // un.a(): the attack target is stored first but then overwritten by the lookup (batch 31, village-fight-b31-reference.json: a bow-less skeleton with a
    // player target and no player within 8 blocks does not start watching): the closest player, or World.findNearestEntityWithinAABB(class, box.expand(range, 3, range), self)
    if (this.watched === "player") this.target = m.ai.closestPlayer(m, this.range);
    else {
      let best = null, bd = Infinity;
      for (const b of m.nearby(this.range, 3, this.range, (o) => (this.watched === "villager" ? o.e.type === "villager" : o.e.type !== "ender_crystal"), 0, true)) {
        const d = m.distSq(b);
        if (d < bd) { best = b; bd = d; }
      }
      this.target = best;
    }
    return !!this.target;
  }
  continueExecuting() {
    if (!this.target.alive) return false;
    if (this.m.distSq(this.target) > f(this.range * this.range)) return false;
    return this.timer > 0;
  }
  startExecuting() {
    this.timer = 40 + this.m.rand.nextInt(40);
  }
  resetTask() {
    this.target = null;
  }
  updateTask() {
    const m = this.m;
    m.lookHelper.setLookPosition(this.target.x, this.target.y + this.target.eyeHeight, this.target.z, 10, m.verticalFaceSpeed);
    this.timer--;
  }
}
// EntityAILookIdle (vb), mutex 3: 2% a tick, a random heading held for 20 to 39 ticks.
class LookIdle extends Task {
  constructor(m) {
    super();
    this.m = m;
    this.mutex = 3;
    this.dx = 0;
    this.dz = 0;
    this.timer = 0;
  }
  shouldExecute() {
    return this.m.rand.nextFloat() < f(0.02);
  }
  continueExecuting() {
    return this.timer >= 0;
  }
  startExecuting() {
    const a = 2 * Math.PI * this.m.rand.nextDouble();
    this.dx = Math.cos(a);
    this.dz = Math.sin(a);
    this.timer = 20 + this.m.rand.nextInt(20);
  }
  updateTask() {
    const m = this.m;
    this.timer--;
    m.lookHelper.setLookPosition(m.x + this.dx, m.y + m.eyeHeight, m.z + this.dz, 10, m.verticalFaceSpeed);
  }
}
// EntityAIEatGrass (ud), mutex 7: 1 in 1000 (1 in 50 for a lamb) with tall grass at
// the feet or a grass block below; a 40 tick timer (mirrored in e.eatTimer, which the
// renderer reads) whose tick 4 eats the grass and runs EntitySheep.eatGrassBonus.
class EatGrass extends Task {
  constructor(m) {
    super();
    this.m = m;
    this.mutex = 7;
  }
  shouldExecute() {
    const e = this.m.e;
    if (this.m.rand.nextInt(e.growingAge < 0 ? 50 : 1000) !== 0) return false;
    const w = this.m.ai.world, x = Math.floor(e.x), y = Math.floor(e.y), z = Math.floor(e.z);
    return w.get(x, y, z) === TALL_GRASS || w.get(x, y - 1, z) === GRASS;
  }
  startExecuting() {
    this.m.e.eatTimer = 40;
    this.m.navigator.clearPathEntity();
  }
  resetTask() {
    this.m.e.eatTimer = 0;
  }
  continueExecuting() {
    return this.m.e.eatTimer > 0;
  }
  updateTask() {
    const e = this.m.e;
    e.eatTimer = Math.max(0, e.eatTimer - 1);
    if (e.eatTimer === 4) this.m.ai.eatGrass(e);
  }
}
// EntityAIAttackOnCollide (uq, class EntityPlayer, longMemory false), mutex 3: a path
// to the attack target is searched when the task is considered; it ends with the
// path. While running the path is renewed after 4 to 10 ticks (more when far or when
// the search fails) when the target moved a block or at 5% a tick, and the mob hits
// at reach (2 * width)^2 + target width with a 20 tick delay.
class AttackOnCollide extends Task {
  // `kind` is the target class (null any, "player", "villager"); `longMemory` keeps the chase going while the target is
  // inside the home area instead of while a path remains (uq's classTarget and field_75437_f).
  constructor(m, speed, kind = null, longMemory = false) {
    super();
    this.m = m;
    this.speed = speed;
    this.kind = kind;
    this.longMemory = longMemory;
    this.mutex = 3;
    this.path = null;
    this.delay = 0;
    this.attackTick = 0;
    this.last = { x: 0, y: 0, z: 0 };
  }
  shouldExecute() {
    const t = this.m.attackTarget;
    if (!t || !t.alive) return false;
    if (this.kind && (this.kind === "player") !== !!t.isPlayer) return false;
    if (this.kind === "villager" && t.e?.type !== "villager") return false;
    this.path = this.m.navigator.getPathToEntityLiving(t);
    return !!this.path;
  }
  continueExecuting() {
    const t = this.m.attackTarget;
    if (!t || !t.alive) return false;
    if (this.longMemory) return isWithinHome(this.m.e, Math.floor(t.x), Math.floor(t.y), Math.floor(t.z));
    return !this.m.navigator.noPath();
  }
  startExecuting() {
    this.m.navigator.setPath(this.path, this.speed);
    this.delay = 0;
  }
  resetTask() {
    this.m.navigator.clearPathEntity();
  }
  updateTask() {
    const m = this.m, t = m.attackTarget, r = m.rand;
    m.lookHelper.setLookPositionWithEntity(t, 30, 30);
    const d = m.distSq(t), reach = f(f(f(f(m.width * 2) * m.width) * 2) + t.width);
    this.delay--;
    if ((this.longMemory || m.canSee(t)) && this.delay <= 0) { // uq.e: the long-memory flag skips the sight test
      const moved = this.last.x === 0 && this.last.y === 0 && this.last.z === 0 ? true : (t.x - this.last.x) ** 2 + (t.y - this.last.y) ** 2 + (t.z - this.last.z) ** 2 >= 1;
      if (moved || r.nextFloat() < f(0.05)) {
        this.last = { x: t.x, y: t.y, z: t.z };
        this.delay = 4 + r.nextInt(7);
        if (d > 1024) this.delay += 10;
        else if (d > 256) this.delay += 5;
        if (!m.navigator.tryMoveToEntityLiving(t, this.speed)) this.delay += 15;
      }
    }
    this.attackTick = Math.max(this.attackTick - 1, 0);
    if (d <= reach && this.attackTick <= 20) {
      this.attackTick = 20;
      if (t.isPlayer) m.ai.attackPlayer(m, t);
      else m.ai.attackMob(m, t);
    }
  }
}
// EntityAIArrowAttack (vd, speed 1.0, min 20, max 60, range 15), mutex 3, for the skeleton:
// while it has an attack target it walks to it (the path is dropped once the target has been
// seen for 20 ticks within the range), looks at it, and when the shot timer reaches 0 shoots
// if the target is in range and seen, with a power of distance / range clamped to
// [0.1, 1]; the next shot is floor(distance / range * (max - min) + min) ticks away.
class ArrowAttack extends Task {
  constructor(m, speed, min, max, range) {
    super();
    this.m = m;
    this.speed = speed;
    this.min = min;
    this.max = max;
    this.range = f(range);
    this.rangeSq = f(this.range * this.range);
    this.mutex = 3;
    this.target = null;
    this.time = -1;
    this.seen = 0;
  }
  shouldExecute() {
    const t = this.m.attackTarget;
    if (!t) return false;
    this.target = t;
    return true;
  }
  continueExecuting() {
    return this.shouldExecute() || !this.m.navigator.noPath();
  }
  resetTask() {
    this.target = null;
    this.seen = 0;
    this.time = -1;
  }
  updateTask() {
    const m = this.m, t = this.target, d = m.distSq(t), sees = m.canSee(t);
    if (sees) this.seen++;
    else this.seen = 0;
    if (d <= this.rangeSq && this.seen >= 20) m.navigator.clearPathEntity();
    else m.navigator.tryMoveToEntityLiving(t, this.speed);
    m.lookHelper.setLookPositionWithEntity(t, 30, 30);
    if (--this.time === 0) {
      if (d > this.rangeSq || !sees) return;
      const fraction = f(f(Math.sqrt(d)) / this.range), scale = fraction < f(0.1) ? f(0.1) : fraction > 1 ? 1 : fraction;
      m.ai.rangedAttack(m, t, scale);
      this.time = Math.floor(f(f(fraction * (this.max - this.min)) + this.min));
    } else if (this.time < 0) {
      const fraction = f(f(Math.sqrt(d)) / this.range);
      this.time = Math.floor(f(f(fraction * (this.max - this.min)) + this.min));
    }
  }
}
// EntityAICreeperSwell (vi), mutex 1: a creeper already swelling, or with its attack target
// within 3 blocks, stops its path and swells while the target stays in sight within 7
// blocks (creeper.js swellShould / swellState). Being ahead of EntityAIAttackOnCollide on
// a shared mutex bit, it keeps the creeper from ever striking.
class CreeperSwell extends Task {
  constructor(m) {
    super();
    this.m = m;
    this.mutex = 1;
    this.target = null;
  }
  shouldExecute() {
    const m = this.m, t = m.attackTarget;
    return swellShould(m.e.creeperState, t ? m.distSq(t) : null);
  }
  startExecuting() {
    this.m.navigator.clearPathEntity();
    this.target = this.m.attackTarget;
  }
  resetTask() {
    this.target = null;
  }
  updateTask() {
    const m = this.m, t = this.target;
    m.e.creeperState = t ? swellState(m.distSq(t), m.canSee(t)) : -1;
  }
}
// EntityAIRestrictSun (vf): in daylight the navigator avoids paths under open sky.
class RestrictSun extends Task {
  constructor(m) {
    super();
    this.m = m;
  }
  shouldExecute() {
    return this.m.ai.isDaytime();
  }
  startExecuting() {
    this.m.navigator.setAvoidSun(true);
  }
  resetTask() {
    this.m.navigator.setAvoidSun(false);
  }
}
// EntityAIFleeSun (ue, speed 1.0), mutex 1: a burning creature under open sky in daylight
// looks for a shade (ten random cells within +-10, -3..+2, +-10 that cannot see the sky
// and have a negative path weight) and walks to it.
class FleeSun extends Task {
  constructor(m, speed) {
    super();
    this.m = m;
    this.speed = speed;
    this.mutex = 1;
    this.target = null;
  }
  shouldExecute() {
    const m = this.m, ai = m.ai;
    if (!ai.isDaytime() || !m.e.fire || m.e.fire <= 0) return false;
    if (!ai.canSeeSky(Math.floor(m.x), Math.trunc(m.minY), Math.floor(m.z))) return false;
    const r = m.rand;
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(m.x + r.nextInt(20) - 10), y = Math.floor(m.minY + r.nextInt(6) - 3), z = Math.floor(m.z + r.nextInt(20) - 10);
      if (!ai.canSeeSky(x, y, z) && m.getBlockPathWeight(x, y, z) < 0) {
        this.target = { x, y, z };
        return true;
      }
    }
    return false;
  }
  continueExecuting() {
    return !this.m.navigator.noPath();
  }
  startExecuting() {
    this.m.navigator.tryMoveToXYZ(this.target.x, this.target.y, this.target.z, this.speed);
  }
}
// EntityAINearestAttackableTarget (vo, EntityPlayer, chance 0, checks sight) and its
// base EntityAITarget (vu), mutex 1. A suitable target is a living, not creative
// player the mob can see; the nearest one in a box of follow range by 4 blocks (by
// follow range) is taken, and it is kept while alive, in range, not creative and
// not out of sight for more than 60 ticks.
class TargetBase extends Task {
  constructor(m, checkSight) {
    super();
    this.m = m;
    this.checkSight = checkSight;
    this.mutex = 1;
    this.sightCounter = 0;
  }
  range() {
    return this.m.navigator.followRange;
  }
  isSuitableTarget(t, mustSee) {
    if (!t || !t.alive) return false;
    if (t.isPlayer && !mustSee && t.creative) return false;
    if (this.checkSight && !this.m.canSee(t)) return false;
    return true;
  }
  continueExecuting() {
    const t = this.m.attackTarget;
    if (!t || !t.alive) return false;
    const range = this.range();
    if (this.m.distSq(t) > range * range) return false;
    if (this.checkSight) {
      if (this.m.canSee(t)) this.sightCounter = 0;
      else if (++this.sightCounter > 60) return false;
    }
    if (t.isPlayer && t.creative) return false;
    return true;
  }
  startExecuting() {
    this.sightCounter = 0;
  }
  resetTask() {
    this.m.attackTarget = null;
  }
}
// 1.7.10 detail (bytecode of vo, vp and vu, probes/DetectionProbe.java): this task's selector (vu.a(sv, false)) has no sneaking or
// invisibility scaling, only the follow range box (range x 4 x range), disableDamage, the home area and, when asked, sight. The scaling
// of those two states lives in World.getClosestVulnerablePlayer (MobAI.closestVulnerablePlayer) used by the legacy mobs.
class NearestAttackable extends TargetBase {
  constructor(m) {
    super(m, true);
    this.target = null;
  }
  shouldExecute() {
    const m = this.m, d = this.range(), p = m.ai.player;
    if (!p || !m.ai.overlaps(m, p, d, 4, d)) return false;
    if (!this.isSuitableTarget(p, false)) return false;
    this.target = p;
    return true;
  }
  startExecuting() {
    this.m.attackTarget = this.target;
    super.startExecuting();
  }
}
// EntityAIHurtByTarget (vn, callsForHelp true), mutex 1: a new revenge target (the
// player who hit it) becomes the attack target, sight not required, and idle mobs of
// the kind within the follow range take it too.
class HurtByTarget extends TargetBase {
  constructor(m, help = true) {
    super(m, false);
    this.last = 0;
    this.help = help;
  }
  shouldExecute() {
    const m = this.m;
    return m.e.revenge !== this.last && this.isSuitableTarget(m.revengeTarget, false);
  }
  startExecuting() {
    const m = this.m;
    m.attackTarget = m.revengeTarget;
    this.last = m.e.revenge;
    const d = this.range();
    if (this.help) for (const o of m.nearby(d, 10, d, (b) => b.e.type === m.e.type, 1)) if (!o.attackTarget) o.attackTarget = m.revengeTarget;
    super.startExecuting();
  }
}

// The village tasks and the villager target a zombie uses, built once (they take Task/TargetBase from this file).
let zombieKit = null;
const zombieVillage = () => (zombieKit ??= { ...villageTasks({ Task, TargetBase }), ...zombieVillagerTargets({ TargetBase }) });

// EntityMob subclasses that run Brain.updateAITasks (spiders, silverfish and giants keep their own think).
const ENTITY_MOB = new Set(["zombie", "pigman", "skeleton", "wither_skeleton", "creeper", "enderman", "witch", "blaze", "wither"]);

// --- One mob's brain: the entity as the navigator, helpers and tasks see it ---
export class Brain {
  constructor(e, ai) {
    this.e = e;
    this.ai = ai;
    this.rand = ai.rand;
    this.attackTarget = null;
    this.senseCache = new Map();
    this.verticalFaceSpeed = 40;
    this.isPlayer = false;
    const type = ai.types[e.type];
    this.navigator = new PathNavigate(this, ai.world, { followRange: Number.isFinite(e.followRange) ? e.followRange : e.type === "zombie" || e.type === "wither" ? 40 : 16, budget: ai.budget });
    this.moveHelper = new MoveHelper(this);
    this.lookHelper = new LookHelper(this);
    this.jumpHelper = new JumpHelper(this);
    this.tasks = new TaskList();
    this.targets = new TaskList();
    const A = type.ai, wheat = ai.breedItems[e.type];
    if (e.type === "zombie") {
      // Every EntityAI* of a zombie draws on Entity.rand (getRNG), the same stream as its living-sound roll (zombie-door-walk-reference.json).
      if (ai.deps.entityRandom) this.rand = ai.deps.entityRandom(e);
      // EntityZombie (yq): swim 0, break door 1 (added by setBreakDoorsAItask, see below), attack players 2, attack villagers 4 (long memory),
      // move towards restriction 5, move through village 6, wander 7, watch 8, look idle 8; targets hurt-by 1,
      // nearest player 2 and nearest villager 2 (zombie-villager.md).
      this.tasks.add(0, new Swim(this));
      this.tasks.add(2, new AttackOnCollide(this, A.chase, "player"));
      this.tasks.add(4, new AttackOnCollide(this, A.chase, "villager", true));
      this.tasks.add(5, new (zombieVillage().MoveTowardsRestriction)(this, 1.0));
      this.tasks.add(6, new (zombieVillage().MoveThroughVillage)(this, 1.0, false));
      this.tasks.add(7, new Wander(this, A.wander));
      this.tasks.add(8, new WatchClosest(this, 8));
      this.tasks.add(8, new LookIdle(this));
      this.targets.add(1, new HurtByTarget(this));
      this.targets.add(2, new NearestAttackable(this));
      this.targets.add(2, new (zombieVillage().NearestVillager)(this));
      // EntityZombie's constructor: getNavigator().setBreakDoors(true); the break-door task itself follows e.canBreakDoors.
      this.navigator.setBreakDoors(true);
    } else if (e.type === "villager") {
      // EntityVillager (yv): its task list is villager.js; it draws on Entity.rand (the entity's own
      // java.util.Random, shared with the living-sound roll) and runs updateAITick after the navigator.
      if (ai.deps.entityRandom) this.rand = ai.deps.entityRandom(e);
      this.randomTickDivider = 0;
      this.updateAITick = () => updateVillagerAI(this);
      buildVillagerTasks(this, { Task, Swim, Wander, WatchClosest, TargetBase });
    } else if (e.type === "iron_golem") {
      // EntityIronGolem (wt): attack on collide 1 (1.0, long memory), move towards target 2 (0.9, 32), move through
      // village 3 (0.6, nocturnal), move towards restriction 4 (1.0), look at villager 5, wander 6 (0.6), watch the
      // player 7 (6 blocks, 0.02), look idle 8; targets defend village 1, hurt-by 2 (no call for help), nearest
      // monster 3 (no sight check). Entity.rand drives it; the village refresh runs after the navigator.
      if (ai.deps.entityRandom) this.rand = ai.deps.entityRandom(e);
      this.randomTickDivider = 0;
      const V = villageTasks({ Task, TargetBase });
      this.updateAITick = () => {
        if (--this.randomTickDivider > 0) return;
        this.randomTickDivider = 70 + this.rand.nextInt(50);
        this.village = nearestVillage(this, 32);
        if (!this.village) return detachHome(e);
        const [cx, cy, cz] = this.village.center;
        setHomeArea(e, cx, cy, cz, Math.trunc(f(this.village.radius * f(0.6))));
      };
      // attackTimer and holdRoseTick count down at the end of onLivingUpdate (EntityWorld.golemTail), after the AI.
      this.navigator.setAvoidsWater(true);
      this.tasks.add(1, new V.GolemAttack(this, 1.0));
      this.tasks.add(2, new V.MoveTowardsTarget(this, 0.9, 32));
      this.tasks.add(3, new V.MoveThroughVillage(this, 0.6, true));
      this.tasks.add(4, new V.MoveTowardsRestriction(this, 1.0));
      this.tasks.add(5, new V.LookAtVillager(this));
      this.tasks.add(6, new Wander(this, A.wander));
      this.tasks.add(7, Object.assign(new WatchClosest(this, 6), { chance: f(0.02) }));
      this.tasks.add(8, new LookIdle(this));
      this.targets.add(1, new V.DefendVillage(this));
      this.targets.add(2, new V.GolemHurtBy(this));
      this.targets.add(3, new V.NearestMonster(this));
    } else if (e.type === "spider" || e.type === "cave_spider" || e.type === "silverfish" || e.type === "giant") {
      // EntitySpider (and EntityCaveSpider) use legacy EntityCreature AI; EntityWorld.spiderThink drives it. So does
      // EntitySilverfish (silverfishThink) and EntityGiantZombie (giantThink): no tasks.
    } else if (e.type === "creeper") {
      // EntityCreeper (xz): swim 1, swell 2, avoid ocelots 3 (6 blocks, 1.0 far, 1.2 near: ocelot-ai.js), attack on
      // collide 4 (1.0), wander 5 (0.8), watch the player 6, look idle 6; targets nearest
      // visible player 1, hurt-by 2 (no call for help).
      this.tasks.add(1, new Swim(this));
      this.tasks.add(2, new CreeperSwell(this));
      this.tasks.add(3, makeAvoid(this, Task, "ocelot", 6, 1.0, 1.2));
      this.tasks.add(4, new AttackOnCollide(this, A.chase));
      this.tasks.add(5, new Wander(this, A.wander));
      this.tasks.add(6, new WatchClosest(this, 8));
      this.tasks.add(6, new LookIdle(this));
      this.targets.add(1, new NearestAttackable(this));
      this.targets.add(2, new HurtByTarget(this, false));
    } else if (e.type === "enderman") {
      // EntityEnderman (ya) is legacy AI in 1.7.10 (no task list): this build approximates it with swim, melee chase (the stare rule
      // in enderman-live.js picks the target) and wander; see public/research/enderman.md.
      this.tasks.add(0, new Swim(this));
      this.tasks.add(2, new AttackOnCollide(this, A.chase, "player"));
      this.tasks.add(7, new Wander(this, A.wander));
      this.targets.add(1, new HurtByTarget(this, false));
    } else if (e.type === "blaze" || e.type === "ghast") {
      buildBlazeGhastTasks(this, { Wander, WatchClosest, LookIdle, NearestAttackable, HurtByTarget, AttackOnCollide }); // blaze-ghast-mobs.js
    } else if (e.type === "wither") {
      buildWitherTasks(this, { Swim, ArrowAttack, Wander, WatchClosest, LookIdle, TargetBase, HurtByTarget }); // wither-boss-mobs.js
    } else if (e.type === "squid" || e.type === "bat") {
      // EntitySquid and EntityBat: no AI tasks (squid-bat-mobs.js drives them); the helpers and despawnEntity still run.
    } else if (e.type === "witch") {
      // EntityWitch (yp): swim 1, the potion ArrowAttack 2 (speed 1.0, interval 60 both ways, range 10), wander 2 (1.0), watch the
      // player 3 (8 blocks), look idle 3; targets hurt-by 1 (no call for help) and the nearest visible player 2.
      this.tasks.add(1, new Swim(this));
      this.tasks.add(2, new ArrowAttack(this, 1, 60, 60, 10));
      this.tasks.add(2, new Wander(this, 1));
      this.tasks.add(3, new WatchClosest(this, 8));
      this.tasks.add(3, new LookIdle(this));
      this.targets.add(1, new HurtByTarget(this, false));
      this.targets.add(2, new NearestAttackable(this));
    } else if (e.type === "skeleton" || e.type === "wither_skeleton") {
      // EntitySkeleton (yl): swim 1, restrict sun 2, flee sun 3, the bow's arrow attack 4
      // (setCombatTask, with a bow in hand), wander 5, watch the player 6, look idle 6;
      // targets hurt-by 1 (no call for help) and the nearest visible player 2.
      // Every EntityAI* of a skeleton draws on Entity.rand too (village-fight-reference.json: Wander nextInt(120), WatchClosest and LookIdle nextFloat).
      if (ai.deps.entityRandom) this.rand = ai.deps.entityRandom(e);
      this.tasks.add(1, new Swim(this));
      this.tasks.add(2, new RestrictSun(this));
      this.tasks.add(3, new FleeSun(this, 1));
      this.tasks.add(5, new Wander(this, A.wander));
      this.tasks.add(6, new WatchClosest(this, 8));
      this.tasks.add(6, new LookIdle(this));
      // The constructor ends with setCombatTask, so the attack task is last in the list: Wander and the look tasks are evaluated before it.
      // The constructor ends with setCombatTask (EntitySkeleton.bZ, also run by setCurrentItemOrArmor(0) and the NBT read): a bow in the held slot gives the
      // arrow attack, anything else AttackOnCollide(player, 1.2, false). Equipment arrives after construction here, so syncCombatTask() re-runs it from the held item.
      this.combatTask = null;
      this.syncCombatTask();
      this.targets.add(1, new HurtByTarget(this, false));
      this.targets.add(2, new NearestAttackable(this));
    } else if (e.type === "snow_golem") {
      buildSnowGolemTasks(this, { Wander, WatchClosest, LookIdle, ArrowAttack, TargetBase }); // EntitySnowman (wr), mooshroom-golem-live.js
    } else if (e.type === "wolf") {
      // EntityWolf (wv): wolf-ai.js lists its tasks and targets and the Brain overrides.
      buildWolfTasks(this, { Task, TargetBase, Swim, Wander, WatchClosest, LookIdle, AttackOnCollide, Mate });
    } else if (e.type === "ocelot") {
      // EntityOcelot (wn): ocelot-ai.js lists its tasks and targets and the Brain overrides.
      buildOcelotTasks(this, { Task, TargetBase, Swim, Wander, WatchClosest, LookIdle, AttackOnCollide, Mate, Tempt });
    } else {
      // EntityCow/Sheep/Chicken: swim 0, panic 1, mate 2, tempt 3, follow parent 4, sheep eat grass 5, wander, watch the
      // player (6 blocks), look idle. EntityPig (wo): swim 0, panic 1, controlled by player 2, mate 3, tempt 4 (carrot on a
      // stick) and 4 (carrot), follow parent 5, wander 6, watch 7, look idle 8 (pig-saddle.js).
      this.navigator.setAvoidsWater(true);
      if (e.type === "pig") {
        this.control = new ControlledByPlayer(this);
        this.tasks.add(0, new Swim(this));
        this.tasks.add(1, new Panic(this, A.panic));
        this.tasks.add(2, this.control);
        this.tasks.add(3, new Mate(this, A.mate));
        this.tasks.add(4, new Tempt(this, A.tempt, CARROT_ON_A_STICK));
        if (wheat) this.tasks.add(4, new Tempt(this, A.tempt, wheat));
        this.tasks.add(5, new FollowParent(this, A.follow));
        this.tasks.add(6, new Wander(this, A.wander));
        this.tasks.add(7, new WatchClosest(this, 6));
        this.tasks.add(8, new LookIdle(this));
        return;
      }
      let p = 0;
      this.tasks.add(p++, new Swim(this));
      this.tasks.add(p++, new Panic(this, A.panic));
      this.tasks.add(p++, new Mate(this, A.mate));
      if (wheat) this.tasks.add(p++, new Tempt(this, A.tempt, wheat));
      this.tasks.add(p++, new FollowParent(this, A.follow));
      if (e.type === "sheep") this.tasks.add(p++, new EatGrass(this));
      this.tasks.add(p++, new Wander(this, A.wander));
      this.tasks.add(p++, new WatchClosest(this, 6));
      this.tasks.add(p++, new LookIdle(this));
    }
  }
  // sw.ax(): the safe-point tries of the PathFinder, by difficulty (difficulty.js).
  maxSafePointTries() {
    if (this.e.type === "creeper") return creeperSafeTries(!!this.attackTarget, this.e.health);
    return maxSafePointTries(!!this.attackTarget, this.e.health, this.ai.types[this.e.type].health, this.ai.deps.difficulty ? this.ai.deps.difficulty() : 2);
  }
  // vv.l: a zombie riding a chicken may navigate off the ground.
  get isRidingChicken() {
    return this.e.type === "zombie" && this.e.ridingEntity?.type === "chicken";
  }
  get x() {
    return this.e.x;
  }
  get y() {
    return this.e.y;
  }
  get z() {
    return this.e.z;
  }
  get minY() {
    return this.e.y;
  }
  get width() {
    return this.ai.size(this.e).width;
  }
  get height() {
    return this.ai.size(this.e).height;
  }
  // EntityLiving.getEyeHeight: height * 0.85.
  get eyeHeight() {
    return f(this.height * f(0.85));
  }
  get inWater() {
    return !!this.e.inWater;
  }
  get inLava() {
    return !!this.e.inLava;
  }
  get onGround() {
    return !!this.e.onGround;
  }
  get alive() {
    return this.e.health > 0;
  }
  get rotationYaw() {
    return this.e.rotationYaw;
  }
  set rotationYaw(v) {
    this.e.rotationYaw = v;
  }
  get rotationYawHead() {
    return this.e.rotationYawHead;
  }
  set rotationYawHead(v) {
    this.e.rotationYawHead = v;
  }
  get renderYawOffset() {
    return this.e.renderYawOffset;
  }
  get rotationPitch() {
    return this.e.rotationPitch;
  }
  set rotationPitch(v) {
    this.e.rotationPitch = v;
  }
  // tv.c's (float)(speed * movementSpeed attribute), as sw.i(F) which also sets moveForward.
  attributeSpeed(multiplier) {
    return this.ai.attributeSpeed(this.e, multiplier);
  }
  setAIMoveSpeed(v) {
    this.e.aiMoveSpeed = v;
    this.e.moveForward = v;
  }
  // EntityLivingBase.getAITarget: whoever hurt this mob last (revenge-target.js), not only the player.
  get revengeTarget() {
    return revengeBrain(this.ai, this.e);
  }
  // Entity.getDistanceSqToEntity: feet to feet.
  distSq(o) {
    const dx = this.x - o.x, dy = this.y - o.y, dz = this.z - o.z;
    return dx * dx + dy * dy + dz * dz;
  }
  // EntitySkeleton.setCombatTask (yl.bZ): removes the bow and the melee task, then adds the one for the held item (priority 4, so last in the list as natively).
  // The held-slot bow (id 261) decides; it is re-read here instead of at each equipment write, so a swap takes effect at the skeleton's next AI tick.
  syncCombatTask() {
    const bow = this.e.equipment?.[0]?.id === 261;
    if (this.combatTask && this.combatBow === bow) return;
    if (this.combatTask) this.tasks.remove(this.combatTask);
    this.combatBow = bow;
    // EntitySkeleton keeps its aiArrowAttack and aiAttackOnCollide as fields built once: a swap back reuses the old object with its timers and last target position
    // (village-fight-b31-reference.json: the re-added AttackOnCollide still rolls its 5 % nextFloat on the stale position).
    const kept = (this.combatTasks ??= {});
    this.combatTask = bow ? (kept.bow ??= new ArrowAttack(this, 1, 20, 60, 15)) : (kept.melee ??= new AttackOnCollide(this, 1.2, "player", false));
    this.tasks.add(4, this.combatTask);
  }
  // EntitySenses.canSee (vw.a): a line from eye to eye with no block in the way,
  // cached for the tick.
  canSee(t) {
    if (this.senseCache.has(t)) return this.senseCache.get(t);
    // Batch 32: World.rayTraceBlocks(eye, eye) itself (cell walk, Block.collisionRayTrace), not the click ray's 0.025 sampling, which misses a grazing line
    // (a zombie against a door slab lost sight one tick late in the village-fight b31 records).
    const ax = this.x, ay = this.y + this.eyeHeight, az = this.z;
    const seen = !rayTraceBlocks(this.ai.world, [ax, ay, az], [t.x, t.y + t.eyeHeight, t.z]);
    this.senseCache.set(t, seen);
    return seen;
  }
  // World.getEntitiesWithinAABB around this mob's box grown by (rx, ry, rz).
  // `dying` keeps mobs with health 0 that are not yet removed: World.getEntitiesWithinAABB lists a corpse until setDead (deathTime 20), and only the task's own
  // isEntityAlive test drops it (findNearestEntityWithinAABB in EntityAIWatchClosest hands back a corpse, which ends the watch one tick later).
  nearby(rx, ry, rz, test, base = 0, dying = false) {
    const out = [];
    for (const e of this.ai.entities()) {
      if (e === this.e || (e.health <= 0 && !(dying && (e.death ?? 0) < 20))) continue;
      const b = this.ai.brain(e);
      if (test(b) && this.ai.overlaps(this, b, rx, ry, rz, base)) out.push(b);
    }
    return out;
  }
  // EntityAnimal.getBlockPathWeight (wf.a(III)F): 10 on grass, else brightness - 0.5;
  // EntityMob (yg): 0.5 - brightness.
  getBlockPathWeight(x, y, z) {
    const w = this.ai.world;
    if (this.e.type === "villager" || this.e.type === "iron_golem" || this.e.type === "snow_golem") return f(0); // EntityCreature.getBlockPathWeight
    if (this.e.type === "zombie" || this.e.type === "skeleton" || this.e.type === "wither_skeleton" || this.e.type === "creeper" || this.e.type === "witch" || this.e.type === "enderman") return f(f(0.5) - this.ai.brightness(x, y, z));
    return w.get(x, y - 1, z) === GRASS ? f(10) : f(this.ai.brightness(x, y, z) - f(0.5));
  }
  // sw.bn(): the AI half of onLivingUpdate. Despawning and the idle age come first, then
  // the target tasks, the tasks, the navigator, and the three helpers in order.
  // EntityZombie.setBreakDoorsAItask (yq.a(Z)): the task joins at priority 1 (appended to the list) or leaves it.
  syncBreakDoors() {
    const want = !!this.e.canBreakDoors;
    if (want === !!this.breakDoor) return;
    if (want) {
      this.breakDoor = new (breakDoorClass(Task))(this);
      this.tasks.add(1, this.breakDoor);
    } else {
      this.tasks.remove(this.breakDoor);
      this.breakDoor = null;
    }
  }
  updateAITasks() {
    const e = this.e;
    if (e.type === "zombie") this.syncBreakDoors();
    // EntityMob.onLivingUpdate (yg.e): a brightness above 0.5 at the mob ages it 2 more ticks (the despawn age Wander reads); EntityLiving's
    // updateEntityActionState adds the 1. Seen in village-fight-reference.json: a skeleton in a lit field stops wandering after 34 ticks.
    if (ENTITY_MOB.has(e.type)) {
      const h = this.ai.size(e).height;
      if (this.ai.brightness(Math.floor(e.x), Math.floor(e.y + h * 0.66), Math.floor(e.z)) > 0.5) e.idle = (e.idle || 0) + 2;
    }
    e.idle = (e.idle || 0) + 1;
    this.despawnEntity();
    this.senseCache.clear();
    this.beforeAI?.();
    if (this.combatTask !== undefined) this.syncCombatTask();
    this.targets.tickCount = this.tasks.tickCount = Math.trunc(e.age) - 1;
    this.targets.tick();
    this.tasks.tick();
    this.navigator.onUpdateNavigation();
    this.updateAITick?.();
    this.moveHelper.onUpdateMoveHelper();
    this.lookHelper.onUpdateLook();
    this.jumpHelper.doJump();
    e.yaw = (-e.rotationYaw * Math.PI) / 180;
  }
  // sw.w(): every tick the nearest player decides. Only mobs that may despawn
  // (the zombie) go: beyond 128 blocks at once, beyond 32 after 600 idle ticks with a
  // 1 in 800 roll; within 32 the idle age resets, which is what lets Wander run.
  despawnEntity() {
    const e = this.e, p = this.ai.player;
    if (!p) return; // sw.w() has no age gate in 1.7.10: it runs every tick (bytecode-read)
    const d3 = this.distSq(p), can = canDespawn(e);
    if (can && d3 > 16384) return this.ai.despawn(e);
    if (e.idle > 600 && this.rand.nextInt(800) === 0 && d3 > 1024 && can) return this.ai.despawn(e);
    if (d3 < 1024) e.idle = 0;
  }
}
// !persistenceRequired && canDespawn() (sw.v and its overrides): EntityAnimal, EntityGolem and EntityVillager keep their mobs;
// EntityWolf only a wild wolf older than 2400 ticks, EntityOcelot an untamed one, EntityChicken a jockey; every other living
// mob takes EntityLiving's true (slimes, magma cubes and silverfish included).
const DESPAWNS = new Set(["zombie", "pigman", "skeleton", "wither_skeleton", "witch", "enderman", "spider", "cave_spider", "creeper", "squid", "bat", "blaze", "ghast", "slime", "magma_cube", "silverfish", "giant"]);
export function canDespawn(e) {
  return !e.persistent && ((e.type === "wolf" && !wolfTamed(e) && e.age > 2400) || (e.type === "ocelot" && ocelotCanDespawn(e)) || DESPAWNS.has(e.type) || chickenJockeyDespawns(e));
}

// --- The player as a target and an observer ---
class PlayerView {
  constructor() {
    this.isPlayer = true;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.width = f(0.6);
    this.height = f(1.8);
    // The integrated server's EntityPlayerMP: posY is the feet and getEyeHeight() 0.12.
    this.eyeHeight = f(0.12);
    this.alive = true;
    this.creative = false;
    this.held = 0;
    this.has = true;
    // What World.getClosestVulnerablePlayer reads: isSneaking (set by the host, see living-simulation.js), isInvisible and the worn
    // armour (EntityPlayer.getArmorVisibility).
    this.sneaking = false;
    this.invisible = false;
    this.armorPieces = 0;
  }
  update(player, survival, held) {
    this.x = player.x;
    this.y = player.y;
    this.z = player.z;
    this.alive = !(survival.health <= 0);
    this.creative = !!survival.creative;
    this.held = held;
    this.survival = survival;
    this.invisible = !!survival.effects?.has?.(INVISIBILITY);
    this.armorPieces = (survival.inventory?.armor ?? []).filter(Boolean).length;
  }
  // EntityPlayer.getArmorVisibility (yz.bE): worn pieces over the four armour slots, as a float.
  get armorVisibility() {
    return f(this.armorPieces / 4);
  }
  holds(item) {
    return this.held === item && (this.creative || (this.survival?.count ? this.survival.count(item) > 0 : true));
  }
}

// --- The world's AI service ---
// `deps`: ENTITY_TYPES, BREED_ITEM, aiMoveSpeed(e, multiplier), mobSize(e), spawnBaby(a, b)
// -> boolean, eatGrass(e), attackPlayer(e, survival), despawn(e), lightAt(x, y, z), difficulty().
export class MobAI {
  constructor(ew, deps) {
    this.ew = ew;
    this.deps = deps;
    this.types = deps.ENTITY_TYPES;
    this.breedItems = deps.BREED_ITEM;
    this.brains = new WeakMap();
    this.player = new PlayerView();
    this.rand = new Rand(() => ew.random());
    // Path searches allowed per tick over all mobs (the original has no limit).
    this.budget = { left: 0, denied: 0, perTick: 8 };
    this.survival = null;
    // The world tick count, and what the owner's wolves read from the player: the last creature that hurt it
    // (EntityLivingBase.getAITarget, with its timer) and the last one it hit (getLastAttacker).
    this.clock = 0;
  }
  playerHurtBy(record) {
    Object.assign(this.player, { hurtBy: record, hurtByTime: this.clock });
  }
  playerHit(record) {
    Object.assign(this.player, { lastTarget: record, lastTargetTime: this.clock });
  }
  get world() {
    return this.ew.ring?.view ?? this.ew.world; // a stable object: navigators keep the world they were built with (headless ring view)
  }
  entities() {
    return this.ew.entities;
  }
  brain(e) {
    let b = this.brains.get(e);
    if (!b) this.brains.set(e, (b = new Brain(e, this)));
    return b;
  }
  size(e) {
    return this.deps.mobSize(e);
  }
  attributeSpeed(e, multiplier) {
    return this.deps.aiMoveSpeed(e, multiplier);
  }
  beginTick(player, survival, held) {
    this.player.update(player, survival, held);
    this.clock++;
    this.survival = survival;
    // EntityLivingBase.attackEntityFrom sets the revenge target for every living source entity (arrows' shooters, fireballs, thorns), which the
    // owner's wolves read (EntityAIOwnerHurtByTarget); Survival.damage reports it through this hook.
    if (survival) survival.onRevenge = (record) => this.playerHurtBy(record);
    this.budget.left = this.budget.perTick;
  }
  think(e) {
    this.brain(e).updateAITasks();
  }
  // World.getClosestPlayerToEntity: the (only) player within `range`, creative included.
  closestPlayer(mob, range) {
    const p = this.player;
    return mob.distSq(p) < range * range ? p : null;
  }
  // World.getClosestVulnerablePlayerToEntity (ahb.b(sa, D) -> b(DDDD)) for the one player: not in creative (disableDamage) and alive, and
  // within `range` of the mob's feet, where the range is multiplied by 0.8 (double) when sneaking and by (float)(0.7f * max(0.1f,
  // armour visibility)) when invisible (verified against the bytecode: detection-reference.json). Legacy findPlayerToAttack users:
  // EntityMob (16, with a sight test), EntitySpider (16, brightness below 0.5), EntitySilverfish (8), EntityEnderman (64), EntitySlime
  // (16), EntityGhast (100). The task-based EntityAINearestAttackableTarget does NOT scale (see NearestAttackable).
  closestVulnerablePlayer(mob, range) {
    const p = this.player;
    if (!p?.alive || p.creative) return null;
    let r = range;
    if (p.sneaking) r = r * 0.800000011920929;
    if (p.invisible) r = r * f(f(0.7) * Math.max(f(0.1), p.armorVisibility));
    const dx = mob.x - p.x, dy = mob.y - p.y, dz = mob.z - p.z; // `mob` is an entity or its brain
    return range < 0 || dx * dx + dy * dy + dz * dz < r * r ? p : null;
  }
  // Whether the box of `a` grown by (rx, ry, rz) intersects the box of `b`.
  overlaps(a, b, rx, ry, rz, base = 0) {
    const aw = a.width / 2, bw = b.width / 2;
    return (
      a.x + aw + rx + base > b.x - bw && a.x - aw - rx < b.x + bw + base &&
      a.y + a.height + ry + base > b.y && a.y - ry < b.y + b.height + base &&
      a.z + aw + rz + base > b.z - bw && a.z - aw - rz < b.z + bw + base
    );
  }
  // World.getLightBrightness: the brightness table at the block light value. Without
  // a light engine (tests) a column with open sky is full daylight.
  brightness(x, y, z) {
    let level = (this.ew.brightnessLevel ?? this.ew.lightAt)?.call(this.ew, x, y, z); // brightnessLevel: a replay hook where getLightBrightness and getBlockLightValue differ
    if (level === undefined) {
      level = 15;
      for (let yy = y + 1; yy < (this.world.height ?? HEIGHT); yy++)
        if (this.world.solid(x, yy, z)) {
          level = 0;
          break;
        }
    }
    return BRIGHTNESS[Math.max(0, Math.min(15, level))];
  }
  // World.isDaytime and Chunk.canBlockSeeTheSky for the sun tasks (hooked by the world).
  isDaytime() {
    return !!this.deps.isDaytime?.();
  }
  canSeeSky(x, y, z) {
    return !!this.deps.canSeeSky?.(x, y, z);
  }
  // World.isRaining (hooked by the world; false without one).
  isRaining() {
    return !!this.deps.isRaining?.();
  }
  // EntitySkeleton.attackEntityWithRangedAttack: the shooter and the target's view.
  rangedAttack(m, target, scale) {
    this.deps.rangedAttack?.(m.e, target, scale);
  }
  spawnBaby(a, b) {
    return this.deps.spawnBaby(a.e, b.e);
  }
  eatGrass(e) {
    this.deps.eatGrass(e);
  }
  attackPlayer(m, target) {
    this.deps.attackPlayer(m.e, target.survival);
  }
  // EntityMob.attackEntityAsMob against another creature (a zombie's villager).
  attackMob(m, target) {
    return this.deps.attackMob?.(m.e, target.e);
  }
  despawn(e) {
    this.deps.despawn(e);
  }
}

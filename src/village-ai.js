// The village-dependent AI tasks of 1.7.10: EntityAIMoveIndoors (ur), EntityAIRestrictOpenDoor (ve),
// EntityAIMoveTowardsRestriction (ut), EntityAIVillagerMate (up), EntityAIFollowGolem (vj), EntityAIPlay (va)
// for the villager, and EntityAILookAtVillager (ux), EntityAIMoveTowardsTarget (uu), EntityAIMoveThroughVillage
// (us), EntityAIDefendVillage (vm), the golem's EntityAIAttackOnCollide with long memory (uq) and the golem's
// EntityAINearestAttackableTarget for monsters (vo) for the iron golem. Ported from the bytecode listings
// (public/research/village.md says which parts the probe replays: the shouldExecute gates and the mating
// run). `K` is { Task, Swim, Wander, WatchClosest, LookIdle, HurtByTarget, TargetBase } from ai.js, passed in
// because ai.js imports villager.js and this file is reached from there.
import { findRandomTargetTowards, findRandomTargetDirected, isWithinHome, isWithinHomeHere } from "./home-area.js";
import { golemAttackDamage, golemCanAttack, IRON_GOLEM_SOUNDS } from "./iron-golem.js";
const f = Math.fround;
const floor = Math.floor;

// IMob (EntityMob and slimes, ghasts...): the hostile kinds this build has.
const MONSTERS = new Set(["zombie", "skeleton", "spider", "cave_spider", "silverfish", "witch", "creeper"]);
const villagesOf = (m) => m.ai.ew.villages;
// WorldServer.villageCollectionObj.findNearestVillage at the mob's block.
export const nearestVillage = (m, extra) => villagesOf(m)?.findNearestVillage(floor(m.x), floor(m.y), floor(m.z), extra) ?? null;
// World.setEntityState: 12 hearts, 13 angry villager, 14 happy villager (EntityVillager.handleHealthUpdate,
// 5 particles, generateRandomParticles); 11 / 4 on the golem change the arm pose (entity counters here).
// The client draws them from its own Random, so Entity.rand is left alone.
const visual = { nextFloat: () => Math.random(), nextGaussian: () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()) };
export function villagerParticles(m, name) {
  // EntityWorld.burst (entities.js owns the fx import; fx.js reaches back into entities.js).
  m.ai.ew.villageBurst?.(name, m.e, { width: m.width, height: m.height }, visual);
}

export function villageTasks(K) {
  const { Task } = K;

  // EntityAIMoveIndoors (ur), mutex 1, speed 1.0. In clear daytime it returns before drawing; otherwise it
  // draws nextInt(50), skips a villager standing within 2 blocks of the door it used last, and needs a
  // village within 14 blocks with a door (the one with the fewest openings, vz.c).
  class MoveIndoors extends Task {
    constructor(m) {
      super();
      this.m = m;
      this.mutex = 1;
      this.door = null;
      this.insideX = -1;
      this.insideZ = -1;
    }
    shouldExecute() {
      const m = this.m;
      if (m.ai.isDaytime() && !m.ai.isRaining()) return false;
      if (m.rand.nextInt(50) !== 0) return false;
      if (this.insideX !== -1) {
        const dx = this.insideX - m.x, dy = m.y - m.y, dz = this.insideZ - m.z;
        if (dx * dx + dy * dy + dz * dz < 4) return false;
      }
      const village = nearestVillage(m, 14);
      if (!village) return false;
      this.door = village.nearestDoorUnrestricted(floor(m.x), floor(m.y), floor(m.z));
      return !!this.door;
    }
    continueExecuting() {
      return !this.m.navigator.noPath();
    }
    startExecuting() {
      const m = this.m, d = this.door, ix = d.insidePointX, iz = d.insidePointZ;
      this.insideX = -1;
      const dx = ix - m.x, dy = d.y - m.y, dz = iz - m.z;
      if (dx * dx + dy * dy + dz * dz > 256) {
        const v = findRandomTargetTowards(m, 14, 3, { x: ix + 0.5, y: d.y, z: iz + 0.5 });
        if (v) m.navigator.tryMoveToXYZ(v.x, v.y, v.z, 1);
      } else m.navigator.tryMoveToXYZ(ix + 0.5, d.y, iz + 0.5, 1);
    }
    resetTask() {
      this.insideX = this.door.insidePointX;
      this.insideZ = this.door.insidePointZ;
      this.door = null;
    }
  }

  // EntityAIRestrictOpenDoor (ve), mutex 0: at night a villager within 1.5 blocks of the inside of its village's
  // nearest door (vz.b) stops opening doors and enters them; every tick it counts as a restriction on that door.
  class RestrictOpenDoor extends Task {
    constructor(m) {
      super();
      this.m = m;
      this.mutex = 0;
      this.door = null;
    }
    shouldExecute() {
      const m = this.m;
      if (m.ai.isDaytime()) return false;
      const village = nearestVillage(m, 16);
      if (!village) return false;
      const x = floor(m.x), y = floor(m.y), z = floor(m.z);
      this.door = village.nearestDoor(x, y, z);
      return !!this.door && this.door.distSqToInside(x, y, z) < 2.25;
    }
    continueExecuting() {
      const m = this.m;
      if (m.ai.isDaytime()) return false;
      return !this.door.detached && this.door.isInside(floor(m.x), floor(m.z));
    }
    startExecuting() {
      this.m.navigator.setBreakDoors(false);
      this.m.navigator.setEnterDoors(false);
    }
    resetTask() {
      this.m.navigator.setBreakDoors(true);
      this.m.navigator.setEnterDoors(true);
      this.door = null;
    }
    updateTask() {
      this.door.incrementRestriction();
    }
  }

  // EntityAIMoveTowardsRestriction (ut), mutex 1: outside its home area a mob walks to a cell towards the home
  // (RandomPositionGenerator 16 x 7).
  class MoveTowardsRestriction extends Task {
    constructor(m, speed) {
      super();
      this.m = m;
      this.speed = speed;
      this.mutex = 1;
      this.target = null;
    }
    shouldExecute() {
      const m = this.m;
      if (isWithinHomeHere(m.e)) return false;
      const h = m.e.home;
      this.target = findRandomTargetTowards(m, 16, 7, { x: h.x, y: h.y, z: h.z });
      return !!this.target;
    }
    continueExecuting() {
      return !this.m.navigator.noPath();
    }
    startExecuting() {
      this.m.navigator.tryMoveToXYZ(this.target.x, this.target.y, this.target.z, this.speed);
    }
  }

  // EntityAIVillagerMate (up), mutex 3: an adult (growing age 0) that rolls nextInt(500) near a village (any
  // distance, extra 0) with an unused door rooms (int(doors * 0.35) above the villager count, and a mating
  // season) and an adult villager within (8, 3, 8) walks to it (0.25) for up to 300 ticks; the child is born
  // when the timer reaches 0 within 1.5 blocks. Both parents' ages become 6000, the child's -24000.
  class VillagerMate extends Task {
    constructor(m) {
      super();
      this.m = m;
      this.mutex = 3;
      this.village = null;
      this.mate = null;
      this.timer = 0;
    }
    sufficientDoors() {
      const v = this.village;
      if (!v.isMatingSeason()) return false;
      return v.numVillagers < Math.trunc(v.doors.length * 0.35);
    }
    shouldExecute() {
      const m = this.m;
      if ((m.e.growingAge || 0) !== 0) return false;
      if (m.rand.nextInt(500) !== 0) return false;
      this.village = nearestVillage(m, 0);
      if (!this.village) return false;
      if (!this.sufficientDoors()) return false;
      let best = null, bd = Infinity;
      for (const o of m.nearby(8, 3, 8, (b) => b.e.type === "villager")) {
        const d = m.distSq(o);
        if (d <= bd) { best = o; bd = d; }
      }
      if (!best) return false;
      this.mate = best;
      return (best.e.growingAge || 0) === 0;
    }
    startExecuting() {
      this.timer = 300;
      this.m.e.mating = true;
    }
    resetTask() {
      this.village = null;
      this.mate = null;
      this.m.e.mating = false;
    }
    continueExecuting() {
      return this.timer >= 0 && this.sufficientDoors() && (this.m.e.growingAge || 0) === 0;
    }
    updateTask() {
      const m = this.m, mate = this.mate;
      this.timer--;
      m.lookHelper.setLookPositionWithEntity(mate, 10, 30);
      if (m.distSq(mate) > 2.25) m.navigator.tryMoveToEntityLiving(mate, 0.25);
      else if (this.timer === 0 && mate.e.mating) this.giveBirth();
      if (m.rand.nextInt(35) === 0) villagerParticles(m, "heart");
    }
    giveBirth() {
      const m = this.m, ew = m.ai.ew, mate = this.mate;
      const child = ew.spawnVillagerChild?.(m.e);
      if (!child) return;
      mate.e.growingAge = 6000;
      m.e.growingAge = 6000;
      villagerParticles(m, "heart");
    }
  }

  // EntityAIFollowGolem (vj), mutex 3: a child villager in daylight with an iron golem within (6, 2, 6) that
  // holds a rose waits a random delay (nextInt(320)) and then walks up to take it (0.5), until within 2 blocks.
  class FollowGolem extends Task {
    constructor(m) {
      super();
      this.m = m;
      this.mutex = 3;
      this.golem = null;
      this.delay = 0;
      this.taking = false;
    }
    shouldExecute() {
      const m = this.m;
      if ((m.e.growingAge || 0) >= 0 || !m.ai.isDaytime()) return false;
      this.golem = null;
      for (const g of m.nearby(6, 2, 6, (b) => b.e.type === "iron_golem")) if (g.e.holdRose > 0) { this.golem = g; break; }
      return !!this.golem;
    }
    continueExecuting() {
      return this.golem.e.holdRose > 0;
    }
    startExecuting() {
      this.delay = this.m.rand.nextInt(320);
      this.taking = false;
      this.golem.navigator.clearPathEntity();
    }
    resetTask() {
      this.golem = null;
      this.m.navigator.clearPathEntity();
    }
    updateTask() {
      const m = this.m, g = this.golem;
      m.lookHelper.setLookPositionWithEntity(g, 30, 30);
      if (g.e.holdRose === this.delay) {
        m.navigator.tryMoveToEntityLiving(g, 0.5);
        this.taking = true;
      }
      if (this.taking && m.distSq(g) < 4) {
        g.e.holdRose = 0;
        m.navigator.clearPathEntity();
      }
    }
  }

  // EntityAIPlay (va, speed 0.32), mutex 1: a child rolls nextInt(400), then follows the nearest other child
  // (growing age below 0, not already played with) within (6, 3, 6) or wanders to a random cell (16 x 3), for
  // 1000 ticks.
  class Play extends Task {
    constructor(m, speed) {
      super();
      this.m = m;
      this.speed = speed;
      this.mutex = 1;
      this.follow = null;
      this.delay = 0;
    }
    shouldExecute() {
      const m = this.m;
      if ((m.e.growingAge || 0) >= 0) return false;
      if (m.rand.nextInt(400) !== 0) return false;
      let best = null, bd = Number.MAX_VALUE;
      for (const o of m.nearby(6, 3, 6, (b) => b.e.type === "villager")) {
        if (o.e.playing || (o.e.growingAge || 0) >= 0) continue;
        const d = m.distSq(o);
        if (d <= bd) { best = o; bd = d; }
      }
      this.follow = best;
      if (!best) return !!findRandomTargetDirected(m, 16, 3);
      return true;
    }
    continueExecuting() {
      return this.delay > 0;
    }
    startExecuting() {
      if (this.follow) this.m.e.playing = true;
      this.delay = 1000;
    }
    resetTask() {
      this.m.e.playing = false;
      this.follow = null;
    }
    updateTask() {
      const m = this.m;
      this.delay--;
      if (this.follow) {
        if (m.distSq(this.follow) > 4) m.navigator.tryMoveToEntityLiving(this.follow, this.speed);
      } else if (m.navigator.noPath()) {
        const v = findRandomTargetDirected(m, 16, 3);
        if (v) m.navigator.tryMoveToXYZ(v.x, v.y, v.z, this.speed);
      }
    }
  }

  // EntityAILookAtVillager (ux), mutex 3, the golem's: in daylight a 1 in 8000 roll with a villager within
  // (6, 2, 6) makes it hold out a rose and look at the villager for 400 ticks.
  class LookAtVillager extends Task {
    constructor(m) {
      super();
      this.m = m;
      this.mutex = 3;
      this.villager = null;
      this.time = 0;
    }
    shouldExecute() {
      const m = this.m;
      if (!m.ai.isDaytime()) return false;
      if (m.rand.nextInt(8000) !== 0) return false;
      let best = null, bd = Infinity;
      for (const o of m.nearby(6, 2, 6, (b) => b.e.type === "villager")) {
        const d = m.distSq(o);
        if (d <= bd) { best = o; bd = d; }
      }
      this.villager = best;
      return !!best;
    }
    continueExecuting() {
      return this.time > 0;
    }
    startExecuting() {
      this.time = 400;
      this.m.e.holdRose = 400;
    }
    resetTask() {
      this.m.e.holdRose = 0;
      this.villager = null;
    }
    updateTask() {
      this.m.lookHelper.setLookPositionWithEntity(this.villager, 30, 30);
      this.time--;
    }
  }

  // EntityAIMoveTowardsTarget (uu, speed 0.9, 32 blocks), mutex 1: towards an attack target within range.
  class MoveTowardsTarget extends Task {
    constructor(m, speed, range) {
      super();
      this.m = m;
      this.speed = speed;
      this.range = f(range);
      this.mutex = 1;
      this.target = null;
      this.spot = null;
    }
    shouldExecute() {
      const m = this.m, t = m.attackTarget;
      if (!t) return false;
      this.target = t;
      if (m.distSq(t) > f(this.range * this.range)) return false;
      this.spot = findRandomTargetTowards(m, 16, 7, { x: t.x, y: t.y, z: t.z });
      return !!this.spot;
    }
    continueExecuting() {
      const t = this.target;
      return !this.m.navigator.noPath() && t.alive && this.m.distSq(t) < f(this.range * this.range);
    }
    resetTask() {
      this.target = null;
    }
    startExecuting() {
      this.m.navigator.tryMoveToXYZ(this.spot.x, this.spot.y, this.spot.z, this.speed);
    }
  }

  // EntityAIMoveThroughVillage (us, speed 0.6, only at night), mutex 1: walks to the nearest door of its village
  // that it has not visited among the last 15 (the original also breaks doors off while pathing; approximated).
  class MoveThroughVillage extends Task {
    constructor(m, speed, nocturnal) {
      super();
      this.m = m;
      this.speed = speed;
      this.nocturnal = nocturnal;
      this.mutex = 1;
      this.visited = [];
      this.door = null;
      this.path = null;
    }
    shouldExecute() {
      const m = this.m;
      if (this.visited.length > 15) this.visited.shift();
      if (this.nocturnal && m.ai.isDaytime()) return false;
      const village = nearestVillage(m, 0);
      if (!village) return false;
      let best = null, bd = 2147483647;
      for (const d of village.doors) {
        const s = d.distSqTo(floor(m.x), floor(m.y), floor(m.z));
        if (s < bd && !this.visited.includes(d)) { best = d; bd = s; }
      }
      if (!best) return false;
      this.door = best;
      const nav = m.navigator, flag = nav.canPassClosedDoors;
      nav.setBreakDoors(false);
      this.path = nav.getPathToXYZ(best.x, best.y, best.z);
      nav.setBreakDoors(flag);
      if (this.path) return true;
      const v = findRandomTargetTowards(m, 10, 7, { x: best.x, y: best.y, z: best.z });
      if (!v) return false;
      nav.setBreakDoors(false);
      this.path = nav.getPathToXYZ(v.x, v.y, v.z);
      nav.setBreakDoors(flag);
      return !!this.path;
    }
    continueExecuting() {
      const m = this.m;
      if (m.navigator.noPath()) return false;
      const w = f(m.width + 4), d = this.door;
      return m.distSq({ x: d.x, y: d.y, z: d.z }) > f(w * w);
    }
    startExecuting() {
      const nav = this.m.navigator;
      nav.setBreakDoors(false);
      nav.setPath(this.path, this.speed);
    }
    resetTask() {
      const m = this.m, d = this.door;
      m.navigator.setBreakDoors(true);
      if (d && (m.navigator.noPath() || m.distSq({ x: d.x, y: d.y, z: d.z }) < 16)) this.visited.push(d);
    }
  }

  // EntityAIAttackOnCollide (uq) with long memory, speed 1.0, mutex 3, for the golem: it keeps hunting a target
  // while the target is inside its home area, and hits at (2 * width)^2 + target width. A player target is hit
  // through ew.hitPlayer; any other creature through attackEntityFrom (EntityIronGolem.attackEntityAsMob).
  class GolemAttack extends Task {
    constructor(m, speed) {
      super();
      this.m = m;
      this.speed = speed;
      this.mutex = 3;
      this.path = null;
      this.delay = 0;
      this.attackTick = 0;
      this.last = { x: 0, y: 0, z: 0 };
    }
    shouldExecute() {
      const t = this.m.attackTarget;
      if (!t || !t.alive) return false;
      this.path = this.m.navigator.getPathToEntityLiving(t);
      return !!this.path;
    }
    continueExecuting() {
      const t = this.m.attackTarget;
      if (!t || !t.alive) return false;
      return isWithinHome(this.m.e, floor(t.x), floor(t.y), floor(t.z));
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
      if (m.canSee(t) && this.delay <= 0) {
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
        golemStrike(m, t);
      }
    }
  }

  // EntityAITarget.isSuitableTarget for the golem's target tasks: alive, a class it may attack, inside its home.
  class GolemTargetBase extends K.TargetBase {
    suitable(t) {
      if (!t || !t.alive) return false;
      if (!golemCanAttack(this.m.e, t.isPlayer ? "player" : t.e?.type)) return false;
      return isWithinHome(this.m.e, floor(t.x), floor(t.y), floor(t.z));
    }
    isSuitableTarget(t) {
      return this.suitable(t) && (t.isPlayer ? !t.creative : true);
    }
  }
  // EntityAIDefendVillage (vm), targets priority 1: the nearest aggressor of the village the golem belongs to, or
  // (1 in 20 ticks) the nearest player whose reputation is -15 or lower.
  class DefendVillage extends GolemTargetBase {
    constructor(m) {
      super(m, false);
      this.aggressor = null;
    }
    shouldExecute() {
      const m = this.m, village = m.village;
      if (!village) return false;
      const self = { distSqTo: (o) => m.distSq(o) };
      this.aggressor = village.findNearestAggressor(self);
      if (this.isSuitableTarget(this.aggressor)) return true;
      if (m.rand.nextInt(20) !== 0) return false;
      this.aggressor = village.findNearestTargetPlayer(self);
      return this.isSuitableTarget(this.aggressor);
    }
    startExecuting() {
      this.m.attackTarget = this.aggressor;
      super.startExecuting();
    }
  }
  // EntityAIHurtByTarget (vn, no call for help) with the golem's class filter: a player-created golem never
  // turns on the player.
  class GolemHurtBy extends GolemTargetBase {
    constructor(m) {
      super(m, false);
      this.last = 0;
    }
    shouldExecute() {
      const m = this.m;
      return m.e.revenge !== this.last && this.isSuitableTarget(m.revengeTarget);
    }
    startExecuting() {
      this.m.attackTarget = this.m.revengeTarget;
      this.last = this.m.e.revenge;
      super.startExecuting();
    }
  }
  // EntityAINearestAttackableTarget (vo) for monsters (IMob), no sight needed, nearest within the follow range.
  class NearestMonster extends GolemTargetBase {
    constructor(m) {
      super(m, false);
      this.target = null;
    }
    shouldExecute() {
      const m = this.m, d = this.range();
      let best = null, bd = Infinity;
      for (const o of m.nearby(d, 4, d, (b) => MONSTERS.has(b.e.type) && b.alive)) {
        const s = m.distSq(o);
        if (s < bd && this.isSuitableTarget(o) && s <= d * d) { best = o; bd = s; }
      }
      this.target = best;
      return !!best;
    }
    startExecuting() {
      this.m.attackTarget = this.target;
      super.startExecuting();
    }
  }

  return { MoveIndoors, RestrictOpenDoor, MoveTowardsRestriction, VillagerMate, FollowGolem, Play, LookAtVillager, MoveTowardsTarget, MoveThroughVillage, GolemAttack, DefendVillage, GolemHurtBy, NearestMonster };
}

// EntityIronGolem.attackEntityAsMob (wt.n): state 4 (attackTimer 10), the target takes 7 + nextInt(15) as a mob
// hit (knockback from the golem), a landed hit adds 0.4 to its motionY, and the throw sound plays.
export function golemStrike(m, target) {
  const e = m.e, ew = m.ai.ew, rand = m.rand;
  e.attackTimer = 10;
  const damage = golemAttackDamage(rand);
  let hit;
  if (target.isPlayer) hit = target.survival?.scaledDamage ? ew.hitGolemPlayer?.(e, damage, target.survival) : false;
  else {
    hit = ew.attackEntityFrom(target.e, damage, { from: { x: e.x, z: e.z }, attacker: e, name: "mob", player: false });
    if (hit) target.e.vy += 0.4;
  }
  ew.events.push({ sound: IRON_GOLEM_SOUNDS.throw, volume: 1, pitch: 1, position: { x: e.x, y: e.y, z: e.z } });
  return hit;
}

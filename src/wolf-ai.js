// EntityWolf (wv) and EntityTameable (tg) AI for the Brain of ai.js. The task lists, in 1.7.10's order and with its
// priorities, speeds and mutex bits (see public/research/wolves.md):
//   tasks   1 Swim, 2 Sit (mutex 5), 3 LeapAtTarget 0.4 (5), 4 AttackOnCollide 1.0 long memory (3),
//           5 FollowOwner 1.0 / 10 / 2 (3), 6 Mate 1.0 (3), 7 Wander 1.0 (1), 8 Beg 8 (2), 9 WatchClosest 8 (2),
//           9 LookIdle (3)
//   targets 1 OwnerHurtByTarget (1), 2 OwnerHurtTarget (1), 3 HurtByTarget with help (1), 4 TargetNonTamed sheep 200 (1)
// The classes take Task, TargetBase and the generic tasks from ai.js (as the village kits do), so this file does not
// import it back.
import { ownerPresent, ownerKey } from "./owner-links.js";
import { isTamed, shouldAttackEntity, canMateWith, WOLF_MEAT, BONE } from "./wolf.js";
const f = Math.fround;
// The owner's EntityLivingBase.getAITarget (aJ): the creature that hurt the owner in the last 100 ticks, if it lives.
export function ownerRevenge(ai) {
  const p = ai.player;
  return p.hurtBy && p.hurtBy.health > 0 && ai.clock - p.hurtByTime <= 100 ? p.hurtBy : null;
}
const ownerLastTarget = (ai) => (ai.player.lastTarget && ai.player.lastTarget.health > 0 ? ai.player.lastTarget : null);

// The tasks EntityTameable's two subclasses share, bound to a Brain `m`: EntityAISit (vh), EntityAILeapAtTarget (um, with its
// lift) and EntityAIFollowOwner (ug, with its speed and distances). The ocelot (ocelot-ai.js) reuses them.
export function tameableTasks(m, { Task }) {
  const e = m.e;
  // EntityAISit (vh), mutex 5.
  class Sit extends Task {
    constructor() {
      super();
      this.mutex = 5;
    }
    shouldExecute() {
      if (!isTamed(e) || m.inWater || !m.onGround) return false;
      const owner = m.owner();
      if (!owner) return true;
      return m.distSq(owner) < 144 && ownerRevenge(m.ai) ? false : e.sitWish;
    }
    startExecuting() {
      m.navigator.clearPathEntity();
      e.sitting = true;
    }
    resetTask() {
      e.sitting = false;
    }
  }
  // EntityAILeapAtTarget (um, 0.4F for the wolf, 0.3F for the ocelot), mutex 5: a jump at a target 2 to 4 blocks away (one chance in five a tick).
  class Leap extends Task {
    constructor(lift = 0.4) {
      super();
      this.mutex = 5;
      this.lift = f(lift);
    }
    shouldExecute() {
      const t = m.attackTarget;
      if (!t || !t.alive) return false;
      const d = m.distSq(t);
      if (d < 4 || d > 16) return false;
      return m.onGround ? m.rand.nextInt(5) === 0 : false;
    }
    continueExecuting() {
      return !m.onGround;
    }
    startExecuting() {
      const t = m.attackTarget, dx = t.x - m.x, dz = t.z - m.z, len = f(Math.sqrt(dx * dx + dz * dz)); // MathHelper.sqrt_double returns a float
      if (len > 0) {
        e.vx += (dx / len) * 0.5 * 0.800000011920929 + e.vx * 0.20000000298023224;
        e.vz += (dz / len) * 0.5 * 0.800000011920929 + e.vz * 0.20000000298023224;
      }
      e.vy = this.lift;
    }
  }
  // EntityAIFollowOwner (ug, 1.0, 10, 2), mutex 3.
  class FollowOwner extends Task {
    constructor(speed, minDist, maxDist) {
      super();
      this.speed = speed;
      this.minSq = minDist * minDist;
      this.maxSq = maxDist * maxDist;
      this.mutex = 3;
      this.counter = 0;
      this.avoidWater = false;
    }
    shouldExecute() {
      const owner = m.owner();
      return !!owner && !e.sitting && m.distSq(owner) >= this.minSq;
    }
    continueExecuting() {
      const owner = m.owner();
      return !!owner && !m.navigator.noPath() && m.distSq(owner) > this.maxSq && !e.sitting;
    }
    startExecuting() {
      this.counter = 0;
      this.avoidWater = m.navigator.getAvoidsWater();
      m.navigator.setAvoidsWater(false);
    }
    resetTask() {
      m.navigator.clearPathEntity();
      m.navigator.setAvoidsWater(this.avoidWater);
    }
    updateTask() {
      const owner = m.owner();
      m.lookHelper.setLookPositionWithEntity(owner, 10, m.verticalFaceSpeed);
      if (e.sitting) return;
      if (--this.counter > 0) return;
      this.counter = 10;
      if (!m.navigator.tryMoveToEntityLiving(owner, this.speed) && m.distSq(owner) >= 144) this.teleport(owner);
    }
    // ug.f: the first free spot of the 5 x 5 ring around the owner (not the 3 x 3 inside it) with a solid floor and
    // two non-solid cells above, in x then z order; the wolf lands at its centre with no path.
    teleport(owner) {
      const w = m.ai.world, x0 = Math.floor(owner.x) - 2, z0 = Math.floor(owner.z) - 2, y = Math.floor(owner.y);
      for (let i = 0; i <= 4; i++)
        for (let j = 0; j <= 4; j++) {
          if (i >= 1 && i <= 3 && j >= 1 && j <= 3) continue;
          const x = x0 + i, z = z0 + j;
          if (w.solid(x, y - 1, z) && !w.solid(x, y, z) && !w.solid(x, y + 1, z)) {
            e.x = e.px = x + 0.5;
            e.y = e.py = y;
            e.z = e.pz = z + 0.5;
            m.navigator.clearPathEntity();
            return;
          }
        }
    }
  }
  return { Sit, Leap, FollowOwner };
}

// Installs the wolf's overrides on a Brain and fills its task lists.
export function buildWolfTasks(m, K) {
  const { Task, TargetBase, Swim, Wander, WatchClosest, LookIdle, AttackOnCollide, Mate } = K, e = m.e;
  const { Sit, Leap, FollowOwner } = tameableTasks(m, K);
  m.navigator.setAvoidsWater(true);
  // tg.cb: the owner is the (single) player once tamed.
  m.owner = () => (isTamed(e) && ownerPresent(e) ? m.ai.player : null); // an owner who is not here (foreign OwnerUUID) is null
  // EntityWolf.getEyeHeight: height * 0.8; EntityWolf.getVerticalFaceSpeed (x): 20 while sitting, else 40.
  Object.defineProperty(m, "eyeHeight", { get: () => f(m.height * f(0.8)), configurable: true });
  Object.defineProperty(m, "verticalFaceSpeed", { get: () => (e.sitting ? 20 : 40), set() {}, configurable: true });
  // EntityWolf.setAttackTarget (d(sv)): clearing the target ends the anger, a target makes a wild wolf angry.
  let target = null;
  Object.defineProperty(m, "attackTarget", {
    get: () => target,
    set(v) {
      target = v;
      if (!v) e.angry = false;
      else if (!isTamed(e)) e.angry = true;
    },
    configurable: true,
  });
  // The hurt-by target is the Brain default (revenge-target.js): the player or the mob that hit it, for 100 ticks.
  // EntityAITarget.isSuitableTarget (vu.a) on top of TargetBase: an owned wolf never targets its owner or another
  // creature with the same owner (the owner's wolves).
  const suitable = (task, t, mustSee) => {
    if (!TargetBase.prototype.isSuitableTarget.call(task, t, mustSee)) return false;
    if (isTamed(e)) {
      if (t === m.owner()) return false;
      if (t.e && t.e.type === "wolf" && ownerKey(t.e) === ownerKey(e)) return false;
    }
    return true;
  };
  // EntityAIBeg (ty, 8), mutex 2: a bone for a wild wolf or a favourite meat for any wolf, held within 8 blocks.
  class Beg extends Task {
    constructor(range) {
      super();
      this.range = f(range);
      this.mutex = 2;
      this.player = null;
      this.timer = 0;
    }
    // ty.a(yz) (bytecode-read): a bone for an untamed wolf, otherwise (also for an untamed wolf) wv.c(stack), a favourite meat.
    interesting(p) {
      return (!isTamed(e) && p.held === BONE) || WOLF_MEAT.has(p.held);
    }
    shouldExecute() {
      this.player = m.ai.closestPlayer(m, this.range);
      return this.player ? this.interesting(this.player) : false;
    }
    continueExecuting() {
      const p = this.player;
      return !!p && p.alive && m.distSq(p) <= this.range * this.range && this.timer > 0 && this.interesting(p);
    }
    startExecuting() {
      e.begging = true;
      this.timer = 40 + m.rand.nextInt(40);
    }
    resetTask() {
      e.begging = false;
      this.player = null;
    }
    updateTask() {
      m.lookHelper.setLookPosition(this.player.x, this.player.y + this.player.eyeHeight, this.player.z, 10, m.verticalFaceSpeed);
      this.timer--;
    }
  }
  // EntityAIMate for wolves: EntityWolf.canMateWith picks the partner (tamed, standing, both in love).
  class WolfMate extends Mate {
    findPartner() {
      let best = null, dist = Number.MAX_VALUE;
      for (const b of m.nearby(8, 8, 8, (o) => o.e.type === "wolf"))
        if (canMateWith(e, b.e) && m.distSq(b) < dist) {
          dist = m.distSq(b);
          best = b;
        }
      return best;
    }
  }
  // EntityAIOwnerHurtByTarget (vs) and EntityAIOwnerHurtTarget (vt), mutex 1: the creature that hurt the owner and the
  // one the owner hit last, each only once (the timer id), if the wolf may attack it (EntityWolf.a(sv, sv)).
  class OwnerTarget extends TargetBase {
    constructor(pick) {
      super(m, false);
      this.pick = pick;
      this.last = -1;
      this.found = null;
    }
    shouldExecute() {
      if (!isTamed(e)) return false;
      const owner = m.owner();
      if (!owner) return false;
      const [rec, time] = this.pick(m.ai);
      if (!rec || time === this.last) return false;
      const b = m.ai.brain(rec);
      if (!suitable(this, b, false) || !shouldAttackEntity(e, rec)) return false;
      this.found = b;
      this.time = time;
      return true;
    }
    startExecuting() {
      m.attackTarget = this.found;
      this.last = this.time;
      super.startExecuting();
    }
    isSuitableTarget(t, mustSee) {
      return suitable(this, t, mustSee);
    }
  }
  // EntityAIHurtByTarget (vn, callsForHelp): the revenge target becomes the attack target and every other wolf
  // within range without a target joins, unless isOnSameTeam(target) holds: EntityTameable.c (tg) is true when the
  // target is the wolf's owner, so a tamed wolf never joins a call against its own owner.
  class WolfHurtBy extends TargetBase {
    constructor() {
      super(m, false);
      this.last = 0;
    }
    shouldExecute() {
      return e.revenge !== this.last && suitable(this, m.revengeTarget, false);
    }
    startExecuting() {
      const t = m.revengeTarget;
      m.attackTarget = t;
      this.last = e.revenge;
      const d = this.range();
      for (const o of m.nearby(d, 10, d, (b) => b.e.type === "wolf", 1)) if (!o.attackTarget && !(isTamed(o.e) && t.isPlayer)) o.attackTarget = t;
      super.startExecuting();
    }
  }
  // EntityAITargetNonTamed (vr, sheep, 200, no sight check): a wild wolf's chance in 200 to pick the nearest sheep.
  class TargetNonTamed extends TargetBase {
    constructor() {
      super(m, false);
      this.found = null;
    }
    shouldExecute() {
      if (isTamed(e) || m.rand.nextInt(200) !== 0) return false;
      const r = this.range(), list = m.nearby(r, 4, r, (b) => b.e.type === "sheep").filter((b) => suitable(this, b, false));
      if (!list.length) return false;
      list.sort((a, b) => m.distSq(a) - m.distSq(b));
      this.found = list[0];
      return true;
    }
    startExecuting() {
      m.attackTarget = this.found;
      super.startExecuting();
    }
  }
  m.tasks.add(1, new Swim(m));
  m.tasks.add(2, new Sit());
  m.tasks.add(3, new Leap());
  m.tasks.add(4, new AttackOnCollide(m, 1.0, null, true));
  m.tasks.add(5, new FollowOwner(1.0, 10, 2));
  m.tasks.add(6, new WolfMate(m, 1.0));
  m.tasks.add(7, new Wander(m, 1.0));
  m.tasks.add(8, new Beg(8));
  m.tasks.add(9, new WatchClosest(m, 8));
  m.tasks.add(9, new LookIdle(m));
  m.targets.add(1, new OwnerTarget((ai) => [ownerRevenge(ai), ai.player.hurtByTime]));
  m.targets.add(2, new OwnerTarget((ai) => [ownerLastTarget(ai), ai.player.lastTargetTime]));
  m.targets.add(3, new WolfHurtBy());
  m.targets.add(4, new TargetNonTamed());
}

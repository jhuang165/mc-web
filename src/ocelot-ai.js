// EntityOcelot (wn) AI for the Brain of ai.js, and the creeper's EntityAIAvoidEntity (tw) for ocelots. The task lists, in
// 1.7.10's order and with its priorities, speeds and mutex bits (public/research/ocelots.md, ocelot-reference.json "tasks"):
//   tasks   1 Swim (4), 2 Sit (5), 3 Tempt raw fish 0.6 scared (3), 4 AvoidEntity player 16 / 0.8 / 1.33 (1), 5 FollowOwner
//           1.0 / 10 / 5 (3), 6 OcelotSit 1.33 (5), 7 LeapAtTarget 0.3 (5), 8 OcelotAttack (3), 9 Mate 0.8 (3), 10 Wander 0.8 (1),
//           11 WatchClosest player 10 (2)
//   targets 1 TargetNonTamed chicken 750 (1)
//   creeper task 3: AvoidEntity ocelot 6 / 1.0 / 1.2 (1)
// The classes take Task, TargetBase and the generic tasks from ai.js (as wolf-ai.js does), so this file does not import it back.
import { tameableTasks } from "./wolf-ai.js";
import { ownerPresent } from "./owner-links.js";
import { isTamed, isRawFish, canMateWith, movePose, findSitSpot, sitBlockValid, SNEAK_SPEED, SPRINT_SPEED } from "./ocelot.js";
import { BED } from "./world.js";
const f = Math.fround;
// Internal block ids: chest.js CHEST and inventory-transfer.js BLOCK_FURNACE (kept literal so this file imports little).
const CHEST = 41, FURNACE = 14;

// RandomPositionGenerator.findRandomTargetBlockAwayFrom (vx.c, the vector from the threat to the mob as the bias): ten random
// offsets (x, y, z in that order) kept only when they point away from the threat (dot >= 0), the best getBlockPathWeight wins.
export function findRandomTargetAway(mob, xz, yz, threat) {
  const r = mob.rand, ax = mob.x - threat.x, az = mob.z - threat.z;
  let found = false, best = f(-99999), bx = 0, by = 0, bz = 0;
  for (let i = 0; i < 10; i++) {
    const dx = r.nextInt(2 * xz) - xz, dy = r.nextInt(2 * yz) - yz, dz = r.nextInt(2 * xz) - xz;
    if (ax * dx + az * dz < 0) continue;
    const x = dx + Math.floor(mob.x), y = dy + Math.floor(mob.y), z = dz + Math.floor(mob.z), w = mob.getBlockPathWeight(x, y, z);
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

// EntityAIAvoidEntity (tw, class, range, far speed, near speed), mutex 1. The threat is the first living creature of the class
// in the box grown by (range, 3, range) that the mob can see; a tamed ocelot never avoids the player. The path leads to a spot
// no nearer to the threat than the mob is; it runs while a path remains, at the near speed within 7 blocks.
const DEG = 180 / Math.PI;
export function makeAvoid(m, Task, kind, range, farSpeed, nearSpeed) {
  class Avoid extends Task {
    constructor() {
      super();
      this.mutex = 1;
      this.threat = null;
      this.path = null;
    }
    candidates() {
      if (kind === "player") {
        const p = m.ai.player;
        // EntityAIAvoidEntity (tw.a, bytecode-read): for the player class it is World.getClosestPlayerToEntity(entity, range), a sphere (squared distance below range squared), not the grown box.
        return p.alive && m.distSq(p) < range * range && m.canSee(p) ? [p] : [];
      }
      return m.nearby(range, 3, range, (b) => b.e.type === kind).filter((b) => b.alive && m.canSee(b));
    }
    shouldExecute() {
      if (kind === "player" && isTamed(m.e)) return false;
      const list = this.candidates();
      if (!list.length) return false;
      const threat = list[0], spot = findRandomTargetAway(m, 16, 7, threat);
      if (!spot) return false;
      const dt = (threat.x - spot.x) ** 2 + (threat.y - spot.y) ** 2 + (threat.z - spot.z) ** 2;
      if (dt < (threat.x - m.x) ** 2 + (threat.y - m.y) ** 2 + (threat.z - m.z) ** 2) return false;
      const path = m.navigator.getPathToXYZ(spot.x, spot.y, spot.z);
      if (!path || !path.isDestinationSame(spot)) return false;
      this.threat = threat;
      this.path = path;
      return true;
    }
    continueExecuting() {
      return !m.navigator.noPath();
    }
    startExecuting() {
      m.navigator.setPath(this.path, farSpeed);
    }
    resetTask() {
      this.threat = null;
    }
    updateTask() {
      m.navigator.speed = m.distSq(this.threat) < 49 ? nearSpeed : farSpeed;
    }
  }
  return new Avoid();
}

// Installs the ocelot's overrides on a Brain and fills its task lists.
export function buildOcelotTasks(m, K) {
  const { Task, TargetBase, Swim, Wander, WatchClosest, Mate, Tempt } = K, e = m.e;
  const { Sit, Leap, FollowOwner } = tameableTasks(m, K);
  // Entity.rand (the entity's own java.util.Random), which EntityAIOcelotSit draws from.
  const entityRand = () => m.ai.deps.entityRandom?.(e) ?? m.rand;
  // EntityOcelot's constructor: getNavigator().setAvoidsWater(true).
  m.navigator.setAvoidsWater(true);
  // tg.cb: the owner is the (single) player once tamed.
  m.owner = () => (isTamed(e) && ownerPresent(e) ? m.ai.player : null);
  // EntityOcelot.bp (the AI update after the navigator, before the move helper): the speed the helper is about to use
  // decides sneaking (EntityAITempt's 0.6) and sprinting (1.33).
  m.updateAITick = () => Object.assign(e, movePose(m.moveHelper.update, m.moveHelper.speed));
  // EntityAITempt (vk, 0.6, raw fish, scared): starts when the nearest player within 10 holds raw fish; continues only while
  // that player stands still and keeps the view still (within 6 blocks: no movement, pitch and yaw within 5 degrees).
  class OcelotTempt extends Tempt {
    constructor() {
      super(m, 0.6, null);
      this.scared = true;
      this.running = false;
      this.px = this.py = this.pz = 0;
      this.pitch = this.yaw = 0;
    }
    shouldExecute() {
      if (this.cooldown > 0) {
        this.cooldown--;
        return false;
      }
      this.player = m.ai.closestPlayer(m, 10);
      return !!this.player && isRawFish(this.player.held);
    }
    continueExecuting() {
      // vk.f (bytecode-read): startExecuting stores only the player's position; pitch and yaw start at 0 and are stored here (degrees, EntityPlayer.rotationPitch/Yaw).
      // playerLook gives radians in the port's convention (main.js playerEye): rotationYaw = 180 - yaw, rotationPitch = -pitch.
      const p = this.player, v = m.ai.ew.playerLook?.(), look = v ? { yaw: 180 - v.yaw * DEG, pitch: -v.pitch * DEG } : { yaw: this.yaw, pitch: this.pitch };
      if (m.distSq(p) < 36) {
        if ((p.x - this.px) ** 2 + (p.y - this.py) ** 2 + (p.z - this.pz) ** 2 > 0.01) return false;
        if (Math.abs(look.pitch - this.pitch) > 5 || Math.abs(look.yaw - this.yaw) > 5) return false;
      } else {
        this.px = p.x;
        this.py = p.y;
        this.pz = p.z;
      }
      this.pitch = look.pitch;
      this.yaw = look.yaw;
      return this.shouldExecute();
    }
    startExecuting() {
      const p = this.player;
      this.px = p.x;
      this.py = p.y;
      this.pz = p.z;
      this.running = true;
      super.startExecuting();
    }
    resetTask() {
      this.running = false;
      super.resetTask();
    }
  }
  const tempt = new OcelotTempt();
  // EntityOcelot.interact reads the Tempt task's running flag (bq.f()).
  m.temptRunning = () => tempt.running;
  // EntityAIOcelotSit (uw, 1.33), mutex 5: a tamed, standing cat now and then (0.65% a tick, Entity.rand.nextDouble) walks to
  // the nearest chest, lit furnace or bed foot within 8 blocks at its height, sits for 1200 to 2400+ ticks and gives up after 60
  // failed approaches. The blocks come from main.js through EntityWorld.ocelotBlocks (chest users, lit furnaces).
  class OcelotSit extends Task {
    constructor(speed) {
      super();
      this.speed = speed;
      this.mutex = 5;
      this.spot = null;
      this.sat = 0;
      this.tries = 0;
      this.max = 0;
    }
    blocks() {
      const w = m.ai.world, extra = m.ai.ew.ocelotBlocks;
      return {
        valid: (x, y, z) => {
          const id = w.get(x, y, z);
          return sitBlockValid({ chest: id === CHEST, chestUsers: id === CHEST ? extra?.chestUsers?.(x, y, z) ?? 0 : 0, furnaceLit: id === FURNACE && !!extra?.furnaceLit?.(x, y, z), bed: id === BED, bedMeta: id === BED ? w.getMeta(x, y, z) : 0 });
        },
        air: (x, y, z) => w.get(x, y, z) === 0,
      };
    }
    search() {
      this.spot = findSitSpot(m.x, m.y, m.z, this.blocks());
      return !!this.spot;
    }
    shouldExecute() {
      return isTamed(e) && !e.sitting && entityRand().nextDouble() <= 0.006500000134110451 && this.search();
    }
    continueExecuting() {
      const s = this.spot;
      return this.sat <= this.max && this.tries <= 60 && this.blocks().valid(s.x, s.y, s.z);
    }
    startExecuting() {
      const s = this.spot;
      m.navigator.tryMoveToXYZ(s.x + 0.5, s.y + 1, s.z + 0.5, this.speed);
      this.sat = 0;
      this.tries = 0;
      const r = entityRand();
      this.max = r.nextInt(r.nextInt(1200) + 1200) + 1200;
      e.sitWish = false;
    }
    resetTask() {
      e.sitting = false;
    }
    updateTask() {
      const s = this.spot;
      this.sat++;
      e.sitWish = false;
      if ((m.x - s.x) ** 2 + (m.y - (s.y + 1)) ** 2 + (m.z - s.z) ** 2 > 1) {
        e.sitting = false;
        m.navigator.tryMoveToXYZ(s.x + 0.5, s.y + 1, s.z + 0.5, this.speed);
        this.tries++;
      } else if (!e.sitting) e.sitting = true;
      else this.tries--;
    }
  }
  // EntityAIOcelotAttack (uv), mutex 3: closes on the attack target (0.6 beyond 4 blocks, 1.33 in the last stretch, 0.8 in
  // between) and bites at reach (2 * width)^2 with a 20 tick delay.
  class OcelotAttack extends Task {
    constructor() {
      super();
      this.mutex = 3;
      this.delay = 0;
    }
    shouldExecute() {
      return !!m.attackTarget;
    }
    continueExecuting() {
      const t = m.attackTarget;
      return !!t && t.alive && m.distSq(t) <= 225 && (!m.navigator.noPath() || this.shouldExecute());
    }
    resetTask() {
      m.attackTarget = null;
      m.navigator.clearPathEntity();
    }
    updateTask() {
      const t = m.attackTarget;
      m.lookHelper.setLookPositionWithEntity(t, 30, 30);
      const reach = f(f(m.width * 2) * f(m.width * 2)), dist = m.distSq(t);
      let speed = 0.8;
      if (dist > reach && dist < 16) speed = 1.33;
      else if (dist < 225) speed = 0.6;
      m.navigator.tryMoveToEntityLiving(t, speed);
      this.delay = Math.max(this.delay - 1, 0);
      if (dist > reach || this.delay > 0) return;
      this.delay = 20;
      m.ai.attackMob(m, t);
    }
  }
  // EntityOcelot.canMateWith picks the partner (tamed, both in love, sitting ignored).
  class OcelotMate extends Mate {
    findPartner() {
      let best = null, dist = Number.MAX_VALUE;
      for (const b of m.nearby(8, 8, 8, (o) => o.e.type === "ocelot"))
        if (canMateWith(e, b.e) && m.distSq(b) < dist) {
          dist = m.distSq(b);
          best = b;
        }
      return best;
    }
  }
  // EntityAITargetNonTamed (vr, chicken, 750, no sight check): a wild ocelot's chance in 750 to pick the nearest chicken.
  class TargetNonTamed extends TargetBase {
    constructor() {
      super(m, false);
      this.found = null;
    }
    shouldExecute() {
      if (isTamed(e) || m.rand.nextInt(750) !== 0) return false;
      const r = this.range(), list = m.nearby(r, 4, r, (b) => b.e.type === "chicken").filter((b) => this.isSuitableTarget(b, false));
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
  m.tasks.add(3, tempt);
  m.tasks.add(4, makeAvoid(m, Task, "player", 16, 0.8, 1.33));
  m.tasks.add(5, new FollowOwner(1.0, 10, 5));
  m.tasks.add(6, new OcelotSit(1.33));
  m.tasks.add(7, new Leap(0.3));
  m.tasks.add(8, new OcelotAttack());
  m.tasks.add(9, new OcelotMate(m, 0.8));
  m.tasks.add(10, new Wander(m, 0.8));
  m.tasks.add(11, new WatchClosest(m, 10));
  m.targets.add(1, new TargetNonTamed());
}
export { SNEAK_SPEED, SPRINT_SPEED };

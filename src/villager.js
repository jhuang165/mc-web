// Minecraft Java 1.7.10 EntityVillager (yv) without trading: size, attributes, professions and
// textures, sounds, the AI task list and the villager's own AI tick. Checked against the
// unchanged classes by tools/probes/VillagerProbe.java (tools/verify-villager.mjs,
// public/research/villager-reference.json); see public/research/villager.md for what runs.
//
// The task classes need ai.js's Task, Swim, Wander and WatchClosest, and ai.js imports this file,
// so `buildVillagerTasks` receives them instead of importing them (no import cycle).
import { WOODEN_DOOR } from "./world.js";
import { setDoorOpen, doorSound } from "./doors-panes.js";
const f = Math.fround;

// EntityVillager constructor (yv): setSize(0.6F, 1.8F); applyEntityAttributes keeps EntityLiving's 20
// health and the movementSpeed 0.5 base (yv.aD); followRange 16 is EntityLiving's default.
export const VILLAGER = Object.freeze({ health: 20, width: f(0.6), height: f(1.8), movement: 0.5, followRange: 16, talkInterval: 80 });
// ENTITY_TYPES entry: EntityAIWander speed 0.6 (the other speeds live in the task list below).
export const VILLAGER_TYPE = { health: VILLAGER.health, width: VILLAGER.width, height: VILLAGER.height, movement: VILLAGER.movement, ai: { wander: 0.6 }, drop: 0 };
export const VILLAGER_SOUNDS = Object.freeze({ idle: "mob.villager.idle", hit: "mob.villager.hit", death: "mob.villager.death" });

// EntityVillager.getTexture (RenderVillager.func_110775_a): profession 0 farmer, 1 librarian, 2 priest,
// 3 smith, 4 butcher; any other id (a registry profession no mod here adds) draws villager.png.
export const PROFESSIONS = ["farmer", "librarian", "priest", "smith", "butcher"];
const DIRECTORY = "/media/1.7.10/entity/villager/";
export const DEFAULT_TEXTURE = DIRECTORY + "villager.png";
export const villagerTexture = (profession) => (Number.isInteger(profession) && PROFESSIONS[profession] ? DIRECTORY + PROFESSIONS[profession] + ".png" : DEFAULT_TEXTURE);
// readEntityFromNBT keeps any int; this build keeps the five textured professions and, for a larger
// id, the number (drawn with villager.png). Not-a-number reads as 0 (the default of getInteger).
export const readProfession = (v) => (Number.isInteger(v) && v >= 0 && v <= 0x7fffffff ? v : 0);
export const readRiches = (v) => (Number.isInteger(v) && v >= 0 && v <= 0x7fffffff ? v : 0);
// The fields a villager adds to an entity record (yv.b/a(NBT) save Profession and Riches; Offers
// are trading and not kept).
export const villagerFields = (profession = 0, riches = 0) => ({ profession: readProfession(profession), riches: readRiches(riches) });

// The native task list in order (priority, class, mutex bits), `live` meaning this build runs it. The
// inert tasks all depend on a VillageCollection (doors, golems, mating, play) or a trading player.
export const VILLAGER_TASKS = [
  { priority: 0, name: "EntityAISwimming", mutex: 4, live: true },
  { priority: 1, name: "EntityAIAvoidEntity", mutex: 1, live: true },
  { priority: 1, name: "EntityAITradePlayer", mutex: 5, live: false },
  { priority: 1, name: "EntityAILookAtTradePlayer", mutex: 2, live: false },
  { priority: 2, name: "EntityAIMoveIndoors", mutex: 1, live: "random draw only" },
  { priority: 3, name: "EntityAIRestrictOpenDoor", mutex: 0, live: false },
  { priority: 4, name: "EntityAIOpenDoor", mutex: 0, live: true },
  { priority: 5, name: "EntityAIMoveTowardsRestriction", mutex: 1, live: false },
  { priority: 6, name: "EntityAIVillagerMate", mutex: 3, live: "random draw only" },
  { priority: 7, name: "EntityAIFollowGolem", mutex: 3, live: false },
  { priority: 8, name: "EntityAIPlay", mutex: 1, live: false },
  { priority: 9, name: "EntityAIWatchClosest2", mutex: 3, live: true },
  { priority: 9, name: "EntityAIWatchClosest2", mutex: 3, live: true },
  { priority: 9, name: "EntityAIWander", mutex: 1, live: true },
  { priority: 10, name: "EntityAIWatchClosest", mutex: 2, live: true },
];

// A Vec3 in the direction away from `from`, or null (RandomPositionGenerator.findRandomTargetBlockAwayFrom,
// vx.b -> vx.c with a direction): ten random offsets in the box, those pointing against the away
// direction skipped after their three draws, the one with the best path weight kept. No home area.
export function findRandomTargetAwayFrom(m, xz, yz, from) {
  const r = m.rand, ax = m.x - from.x, az = m.z - from.z;
  let found = false, best = f(-99999), bx = 0, by = 0, bz = 0;
  for (let i = 0; i < 10; i++) {
    const dx = r.nextInt(2 * xz) - xz, dy = r.nextInt(2 * yz) - yz, dz = r.nextInt(2 * xz) - xz;
    if (dx * ax + dz * az < 0) continue;
    const x = dx + Math.floor(m.x), y = dy + Math.floor(m.y), z = dz + Math.floor(m.z), w = m.getBlockPathWeight(x, y, z);
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

// EntityAIAvoidEntity (tw) for zombies: the first living zombie the villager can see within the box grown by
// (8, 3, 8) makes it run for a spot away from it (findRandomTarget 16 x 7); it keeps running while its path
// lasts, at 0.6 whether near (under 7 blocks) or far.
function avoidEntityClass(Task) {
  return class AvoidEntity extends Task {
    constructor(m, distance, farSpeed, nearSpeed) {
      super();
      this.m = m;
      this.distance = f(distance);
      this.farSpeed = farSpeed;
      this.nearSpeed = nearSpeed;
      this.mutex = 1;
      this.threat = null;
      this.path = null;
    }
    shouldExecute() {
      const m = this.m, d = this.distance;
      const [threat] = m.nearby(d, 3, d, (b) => b.e.type === "zombie" && b.alive && m.canSee(b));
      if (!threat) return false;
      this.threat = threat;
      const spot = findRandomTargetAwayFrom(m, 16, 7, threat);
      if (!spot) return false;
      // The spot must not be nearer the zombie than the villager is.
      const dx = threat.x - spot.x, dy = threat.y - spot.y, dz = threat.z - spot.z;
      if (dx * dx + dy * dy + dz * dz < m.distSq(threat)) return false;
      this.path = m.navigator.getPathToXYZ(spot.x, spot.y, spot.z);
      return !!this.path && this.path.isDestinationSame(spot);
    }
    continueExecuting() {
      return !this.m.navigator.noPath();
    }
    startExecuting() {
      this.m.navigator.setPath(this.path, this.farSpeed);
    }
    resetTask() {
      this.threat = null;
    }
    updateTask() {
      this.m.navigator.speed = this.m.distSq(this.threat) < 49 ? this.nearSpeed : this.farSpeed;
    }
  };
}

// EntityAIDoorInteract (uc) as EntityAIOpenDoor (uy, closes behind it) for the villager: after a horizontal
// collision, a wooden door within 1.5 blocks of the next two path points (or at the villager's own
// cell) opens at once and stays open for 20 ticks, then closes. uy.c() never calls uc.c(), so the
// "walked past" test of uc.e() never trips (its direction fields stay 0): only the 20 ticks end it.
function openDoorClass(Task) {
  return class OpenDoor extends Task {
    constructor(m, close) {
      super();
      this.m = m;
      this.close = close;
      this.mutex = 0;
      this.timer = 0;
      this.door = null;
    }
    doorAt(x, y, z) {
      return this.m.ai.world.get(x, y, z) === WOODEN_DOOR ? { x, y, z } : null;
    }
    shouldExecute() {
      const m = this.m, e = m.e, nav = m.navigator, path = nav.getPath();
      if (!e.collidedH || !path || path.isFinished() || !nav.canPassClosedDoors) return false;
      for (let i = 0; i < Math.min(path.index + 2, path.length); i++) {
        const p = path.getPathPointFromIndex(i), y = p.y + 1, dx = p.x - m.x, dy = m.y - m.y, dz = p.z - m.z;
        if (dx * dx + dy * dy + dz * dz <= 2.25 && (this.door = this.doorAt(p.x, y, p.z))) return true;
      }
      this.door = this.doorAt(Math.floor(m.x), Math.floor(m.y + 1), Math.floor(m.z));
      return !!this.door;
    }
    continueExecuting() {
      return this.close && this.timer > 0;
    }
    startExecuting() {
      this.timer = 20;
      this.swing(true);
    }
    resetTask() {
      if (this.close) this.swing(false);
    }
    updateTask() {
      this.timer--;
    }
    // BlockDoor.func_150014_a: the lower half's open bit, then aux effect 1003 where the door changed.
    swing(open) {
      const { x, y, z } = this.door, ew = this.m.ai.ew, world = this.m.ai.world;
      if (!setDoorOpen(world, x, y, z, open)) return;
      const low = (world.getMeta(x, y, z) & 8) !== 0 ? y - 1 : y, s = doorSound(ew.random);
      ew.events.push({ sound: s.event, volume: s.volume, pitch: s.pitch, position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, doorUpdate: [[x, low, z], [x, low + 1, z]] });
    }
  };
}

// EntityAIMoveIndoors (ur), mutex 1: at night or in rain it draws nextInt(50) and then needs a village's
// door (VillageCollection.findNearestVillage), which this build has none of, so it never starts. In
// daylight and fair weather it returns before drawing.
function moveIndoorsClass(Task) {
  return class MoveIndoors extends Task {
    constructor(m) {
      super();
      this.m = m;
      this.mutex = 1;
    }
    shouldExecute() {
      const m = this.m;
      if (m.ai.isDaytime() && !m.ai.isRaining()) return false;
      m.rand.nextInt(50);
      return false;
    }
  };
}
// EntityAIVillagerMate (up), mutex 3: an adult (growing age 0) draws nextInt(500) and then needs a village
// with a door and a willing villager; no village here, so it never starts.
function mateClass(Task) {
  return class VillagerMate extends Task {
    constructor(m) {
      super();
      this.m = m;
      this.mutex = 3;
    }
    shouldExecute() {
      const m = this.m;
      if ((m.e.growingAge || 0) !== 0) return false;
      m.rand.nextInt(500);
      return false;
    }
  };
}

// EntityVillager (yv) task list, in registration order. `K` is { Task, Swim, Wander, WatchClosest } from ai.js.
// Tasks that cannot run without a village, a golem or a trader are left out (VILLAGER_TASKS marks them).
export function buildVillagerTasks(m, K) {
  const AvoidEntity = avoidEntityClass(K.Task), OpenDoor = openDoorClass(K.Task), MoveIndoors = moveIndoorsClass(K.Task), Mate = mateClass(K.Task);
  const watch = (range, chance) => Object.assign(new K.WatchClosest(m, range), { chance: f(chance), mutex: 3 });
  m.navigator.setBreakDoors(true);
  m.navigator.setAvoidsWater(true);
  m.tasks.add(0, new K.Swim(m));
  m.tasks.add(1, new AvoidEntity(m, 8, 0.6, 0.6));
  m.tasks.add(2, new MoveIndoors(m));
  m.tasks.add(4, new OpenDoor(m, true));
  m.tasks.add(6, new Mate(m));
  m.tasks.add(9, watch(3, 1));
  m.tasks.add(9, watch(5, 0.02));
  m.tasks.add(9, new K.Wander(m, m.ai.types.villager.ai.wander));
  m.tasks.add(10, new K.WatchClosest(m, 8));
}

// EntityVillager.updateAITick (yv.bp), run after the navigator: every 70 + nextInt(50) ticks (the counter
// starts at 0, so on the first tick) it registers its position with the VillageCollection and looks for a
// village within 32 blocks; none exists here, so it detaches its home (a no-op). Only the draw is kept.
export function updateVillagerAI(m) {
  if (--m.randomTickDivider <= 0) m.randomTickDivider = 70 + m.rand.nextInt(50);
}

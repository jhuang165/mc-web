// EntityAIBreakDoor (tz) over EntityAIDoorInteract (uc), Minecraft Java 1.7.10: a zombie that bumped into something and
// has a closed wooden door within 1.5 blocks of the next two path points (or at its own cell) leans on it for 240 ticks;
// on Hard the door goes. Iron doors are never targets. The task is the zombie's priority 1, present while EntityZombie.
// setBreakDoorsAItask(true) holds (the CanBreakDoors roll, or a leader zombie). Checked against the unchanged classes by
// tools/verify-mob-riding.mjs (public/research/mob-riding-reference.json); notes in public/research/mob-riding.md.
import { WOODEN_DOOR } from "./world.js";
import { doorIsOpen } from "./doors-panes.js";
import { gameRule } from "./game-rules.js";
import { HARD } from "./difficulty.js";
import { JavaRandom } from "./lighting.js";

const f = Math.fround;
// RenderGlobal.playAuxSFX: 1010 mob.zombie.wood and 1012 mob.zombie.woodbreak, volume 2, pitch (r - r) * 0.2 + 1 (client random);
// 2001 is the block break (blockBreak: its sound and particles).
const pitchRoll = (rand) => f(f(f(rand.nextFloat() - rand.nextFloat()) * f(0.2)) + 1);

export function breakDoorClass(Task) {
  return class BreakDoor extends Task {
    constructor(m) {
      super();
      this.m = m;
      this.mutex = 0;
      this.door = null; // { x, y, z }: the cell found, integer coordinates
      this.stopped = false; // EntityAIDoorInteract.hasStoppedDoorInteraction
      this.entityPos = { x: 0, z: 0 };
      this.counter = 0; // tz.i: breakingTime
      this.stage = -1; // tz.j: the last crack stage sent
    }
    get world() {
      return this.m.ai.world;
    }
    get events() {
      return this.m.ai.ew.events;
    }
    // uc.a(): collided horizontally, a path that is not finished that may pass closed doors, then a wooden door near it.
    findDoor() {
      const m = this.m, e = m.e, nav = m.navigator, path = nav.getPath();
      if (!e.collidedH || !path || path.isFinished() || !nav.canPassClosedDoors) return false;
      for (let i = 0; i < Math.min(path.index + 2, path.length); i++) {
        const p = path.getPathPointFromIndex(i), dx = e.x - p.x, dy = e.y - e.y, dz = e.z - p.z;
        if (dx * dx + dy * dy + dz * dz <= 2.25 && this.world.get(p.x, p.y + 1, p.z) === WOODEN_DOOR) {
          this.door = { x: p.x, y: p.y + 1, z: p.z };
          return true;
        }
      }
      const x = Math.floor(e.x), y = Math.floor(e.y + 1), z = Math.floor(e.z);
      this.door = this.world.get(x, y, z) === WOODEN_DOOR ? { x, y, z } : null;
      return !!this.door;
    }
    // tz.a(): the shared search, gamerule mobGriefing and a door that is not open.
    shouldExecute() {
      if (!this.findDoor() || !gameRule("mobGriefing")) return false;
      const { x, y, z } = this.door;
      return !doorIsOpen(this.world, x, y, z);
    }
    // tz.b()
    continueExecuting() {
      const { x, y, z } = this.door, e = this.m.e, dx = e.x - x, dy = e.y - y, dz = e.z - z;
      return this.counter <= 240 && !doorIsOpen(this.world, x, y, z) && dx * dx + dy * dy + dz * dz < 4;
    }
    // uc.c() and tz.c()
    startExecuting() {
      const e = this.m.e;
      this.stopped = false;
      this.entityPos = { x: this.door.x + 0.5 - e.x, z: this.door.z + 0.5 - e.z };
      this.counter = 0;
    }
    // tz.d()
    resetTask() {
      if (this.door) this.crack(-1);
    }
    // uc.e() then tz.e()
    updateTask() {
      const m = this.m, e = m.e, { x, y, z } = this.door, ew = m.ai.ew;
      const fx = f(x + 0.5 - e.x), fz = f(z + 0.5 - e.z);
      if (this.entityPos.x * fx + this.entityPos.z * fz < 0) this.stopped = true;
      const rand = m.ai.deps.entityRandom ? m.ai.deps.entityRandom(e) : m.rand;
      ew.worldRandom ??= new JavaRandom(Math.floor(Math.random() * 2 ** 48));
      if (rand.nextInt(20) === 0) this.sound("mob.zombie.wood");
      this.counter++;
      const stage = Math.trunc(f(f(this.counter / f(240)) * 10));
      if (stage !== this.stage) {
        this.crack(stage);
        this.stage = stage;
      }
      if (this.counter === 240 && ew.difficulty === HARD) {
        const block = this.world.get(x, y, z);
        // World.setBlockToAir: BlockDoor.onNeighborBlockChange removes the other half (doors-panes.js Doors).
        this.world.set(x, y, z, 0);
        this.sound("mob.zombie.woodbreak");
        this.events.push({ blockEdit: [[x, y, z]], blockBreak: { x, y, z, block }, doorBreak: true });
      }
    }
    sound(name) {
      const { x, y, z } = this.door, ew = this.m.ai.ew;
      this.events.push({ sound: name, volume: 2, pitch: pitchRoll(ew.worldRandom), position: { x: x + 0.5, y: y + 0.5, z: z + 0.5 } });
    }
    // World.destroyBlockInWorldPartially(entityId, x, y, z, stage): the crack overlay of the client (stage -1 clears it).
    crack(stage) {
      const { x, y, z } = this.door;
      this.events.push({ blockEdit: [], crack: { id: this.m.e.id, x, y, z, stage } });
    }
  };
}

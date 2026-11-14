// VillageSiege (wb) of 1.7.10: the zombie siege check World.tick (mt.b) runs right after VillageCollection.tick.
// Evidence: public/research/siege-reference.json (tools/verify-siege.mjs, the unchanged class ticked on a probe world, replayed by src/sieges-b67.test.js).
//
// What 1.7.10 really does (bytecode-read, then executed): the state machine runs, the village and spawn-ring searches draw from World.rand, but the spawn-spot search
// (func_75527_a) builds `Vec3.createVectorHelper(x, y, z)` and DISCARDS it (no `return`), so it always returns null. func_75529_b therefore never reports a siege as set up,
// no zombie is ever created and the 20-zombie loop with its 2-tick spacing never starts. The port keeps the observable behaviour: the state, the timers and every random
// draw, and no zombie. (Later versions return the vector; that is not 1.7.10.)
//
// Host: isDaytime() (World.isDaytime, skylightSubtracted < 4), celestialAngle() (World.getCelestialAngle(0)), rand (nextInt(n), nextFloat()),
//       players() ([{x, y, z}]: World.playerEntities), villages (VillageCollection).
import { mhSin, mhCos } from "./lighting.js";

const f = Math.fround, trunc = Math.trunc;
export const SIEGE_NONE = 2, SIEGE_ACTIVE = 1, SIEGE_DAY = 0, SIEGE_START = -1;

export class VillageSiege {
  constructor(host) {
    this.host = host;
    this.state = SIEGE_START; // wb.c: -1 until the first daytime tick; the state is not saved, so a world opened at night starts here
    this.spawnsLeft = 0;      // wb.d
    this.delay = 0;           // wb.e
    this.setUp = false;       // wb.b
  }
  tick() {
    const h = this.host;
    if (h.isDaytime()) { this.state = SIEGE_DAY; return; }
    if (this.state === SIEGE_NONE) return;
    if (this.state === SIEGE_DAY) {
      const angle = h.celestialAngle();
      if (angle < 0.5 || angle > 0.501) return; // only the one tick(s) when the sun is at the horizon rolls
      this.state = h.rand.nextInt(10) === 0 ? SIEGE_ACTIVE : SIEGE_NONE;
      this.setUp = false;
      if (this.state === SIEGE_NONE) return;
    }
    // state 1 (and the initial -1, which falls through the same way)
    if (!this.setUp) {
      if (!this.findSiege()) return;
      this.setUp = true;
    }
    if (this.delay > 0) { this.delay--; return; }
    this.delay = 2;
    if (this.spawnsLeft > 0) this.spawnsLeft--; // func_75530_c would spawn a zombie here; unreachable (see the header)
    else this.state = SIEGE_NONE;
  }
  // wb.b(): for each player, the nearest village (the player's block, +1) with >= 10 doors, a door added >= 20 ticks ago and >= 20 villagers, then a ring point (10 tries)
  // outside every other village, then the spawn-spot search. Returns true only when that search finds a spot (never in 1.7.10).
  findSiege() {
    const h = this.host, rand = h.rand, list = h.villages.villages;
    for (const p of h.players()) {
      const v = h.villages.findNearestVillage(trunc(p.x), trunc(p.y), trunc(p.z), 1);
      if (!v) continue;
      if (v.doors.length < 10) continue;
      if (v.tickCounter - v.lastAddDoorTimestamp < 20) continue;
      if (v.numVillagers < 20) continue;
      const [cx, cy, cz] = v.center, radius = v.radius;
      let gx = 0, gz = 0, blocked = false;
      for (let i = 0; i < 10; i++) {
        gx = cx + trunc(f(mhCos(f(f(rand.nextFloat() * f(3.1415927)) * 2)) * radius) * 0.9);
        gz = cz + trunc(f(mhSin(f(f(rand.nextFloat() * f(3.1415927)) * 2)) * radius) * 0.9);
        blocked = false;
        for (const o of list) if (o !== v && o.isInRange(gx, cy, gz)) { blocked = true; break; }
        if (!blocked) break;
      }
      if (blocked) return false;
      if (this.findSpot(v, gx, cy, gz)) { this.spawnsLeft = 20; this.delay = 0; return true; }
    }
    return false;
  }
  // wb.a(III): ten tries around the ring point; the found Vec3 is dropped by the original, so the result is always null. The draws are still made.
  findSpot(v, x, y, z) {
    const rand = this.host.rand;
    for (let i = 0; i < 10; i++) {
      const px = x + rand.nextInt(16) - 8, py = y + rand.nextInt(6) - 3, pz = z + rand.nextInt(16) - 8;
      void v.isInRange(px, py, pz); // && SpawnerAnimals.canCreatureTypeSpawnAtLocation: no draws, and its result is discarded too
    }
    return null;
  }
}

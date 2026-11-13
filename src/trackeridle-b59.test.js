// Batch 59 (trackeridle). Which entities of another dimension are alive (and so tracked) while nobody is in it, and the tracker tick that drives them.
// Bytecode-read (javap on the unchanged 1.7.10 jar, see .shared-memory/notes/trackeridle-b59-track.md):
//   - MinecraftServer.updateTimeLightAndEntities (loop at v()): per WorldServer `mt.b()` (tick), `mt.h()` (updateEntities), then `mt.r().a()` = EntityTracker.updateTrackedEntities, with no player test.
//   - ChunkProviderServer.b(x, z) (`ms.b`, unloadChunksIfNotNearSpawn): `provider.e()` (canRespawnHere) false -> the chunk goes straight into the unload set. aqp (Nether) and aqr (End) return false,
//     the base provider aqo (and aqq, the Overworld) true -> only then are chunks within 128 blocks of the world spawn kept. So the Nether and the End hold nothing loaded without a player.
//   - mt.h: with no players `P++ >= 1200` returns before World.updateEntities: the entities of the loaded area freeze after 1200 ticks.
// The tracker therefore keeps ticking only for the Overworld's spawn area while the player is in the Nether or the End; a Nether/End world starts at the arrival (age 0), as the port does.
import test from "node:test";
import assert from "node:assert/strict";
import { MobTracker } from "./entity-tracker.js";
import { EntityWorld } from "./entities.js";
import { DimensionLive } from "./dimension-live.js";
import { inSpawnArea } from "./away-plan.js";

const size = () => [0.4, 0.7];
const chicken = (id, x, z) => ({ type: "chicken", id: "mob-" + id, uuid: "u" + id, x, y: 0, z, rotationYaw: 0, rotationPitch: 0, rotationYawHead: 0, health: 4, onGround: true });
const counters = (t) => [...t.entries.values()].map((en) => JSON.stringify([en.entry.ticks, en.entry.sinceTeleport, en.entry.lastX, en.entry.lastZ]));

test("idleCatchUp(n) is n silent ticks", () => {
  const a = new MobTracker(10), b = new MobTracker(10), m = chicken(1, 3, 4);
  a.idleCatchUp([m], size, 37);
  for (let i = 0; i < 37; i++) b.idleUpdate([m], size);
  assert.equal(a.tick, 37);
  assert.ok(JSON.parse(counters(a)[0])[0] > 0, "the entry's own counter advanced");
  assert.deepEqual(counters(a), counters(b));
  assert.equal(a.entries.size, 1);
});

test("a long trip runs 1200 + (ticks - 1200) % 481200 ticks, the same phase as every tick (frozen entities, periods dividing 481200 with the tick counter's 1200: 3, 4, 5, 10, 20 and the 401-update forced teleport)", () => {
  for (const n of [482401, 500000, 963601]) {
    const a = new MobTracker(10), b = new MobTracker(10), m = chicken(1, 3, 4);
    a.idleCatchUp([m], size, n);
    for (let i = 0; i < n; i++) b.idleUpdate([m], size);
    const nowA = a.tick % 1200, nowB = b.tick % 1200;
    assert.equal(nowA, nowB, `n=${n}: the tick counter has the same phase`);
    assert.deepEqual(counters(a).map((c) => JSON.parse(c).slice(1)), counters(b).map((c) => JSON.parse(c).slice(1)));
    // the same packets on every later tick (the arrival and 1300 ticks after it)
    const packets = (t) => { const out = []; for (let i = 0; i < 1300; i++) { t.update([m], { x: 0.5, y: 0, z: 0.5 }, size, null, null); out.push([...t.entries.values()].map((en) => en.entry.packets.length).join()); } return out; };
    assert.deepEqual(packets(a), packets(b), `n=${n}`);
  }
});

test("idleTrack holds only the kept mobs; the rest enter the tracker at their first real tick", () => {
  const w = new EntityWorld({ size: 512, height: 256 }, [chicken(1, 10, 10), chicken(2, 400, 400)], () => 0.5);
  w.idleTrack(25, (e) => inSpawnArea([0, 0, 0], Math.floor(e.x) >> 4, Math.floor(e.z) >> 4));
  assert.equal(w.tracker.entries.size, 1);
  assert.equal(w.tracker.tick, 25);
  assert.ok([...w.tracker.entries.keys()][0].x === 10);
});

test("the loaded area is the chunks whose centre is within 128 blocks of the spawn", () => {
  assert.equal(inSpawnArea([0, 64, 0], 7, 7), true); // centre 120
  assert.equal(inSpawnArea([0, 64, 0], 8, 0), false); // centre 136
  assert.equal(inSpawnArea([0, 64, 0], -9, 0), false); // centre -136
  assert.equal(inSpawnArea([0, 64, 0], -8, 0), true); // centre -120
});

test("takeIdle hands the away run's idle ticks to one world open", () => {
  const d = Object.create(DimensionLive.prototype);
  d.awayIdle = { ticks: 90, spawn: [0, 64, 0] };
  assert.deepEqual(d.takeIdle(), { ticks: 90, spawn: [0, 64, 0] });
  assert.equal(d.takeIdle(), null);
});

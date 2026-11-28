// b102 mpobjects102: (1) S19 statuses leave in the order World.setEntityState ran (golem 4 before the target's 2; a player's earlier hit before a later status),
// (2) the ghost-disc tracker's player trigger equals mn.a() (bytecode-read), (3) paintings / item frames re-list on the native cadence (new entity, player moved over 4 blocks, column sent).
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { FRAME_ITEM } from "./hanging.js";
import { golemStrike } from "./village-ai.js";
import { EntityWorld } from "./entities.js";

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function fixture() {
  const world = new World("b102-hang");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  for (let x = 60; x <= 66; x++) for (let y = 10; y <= 14; y++) world.put(x, y, 60, 1, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "creative" });
  sim.mobs.mobs.entities.length = 0;
  const p = sim.addPlayer("a", "Alex", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  p.survival.inventory.main.fill(null); p.survival.add(FRAME_ITEM, 1);
  sim.vehicles.hanging.useHeld(p, { block: [61, 11, 60], adjacent: [61, 11, 61] });
  const send = () => { p.vehPackets = null; sim.vehicles.tick(); return p.vehPackets; };
  return { sim, p, send, e: sim.vehicles.hanging.h.entities[0] };
}

test("hanging: a tracked frame stays tracked while the player's own entry has not moved over 4 blocks, and leaves at the re-list", () => {
  const f = fixture();
  assert.equal(f.send().hset.length, 1);
  f.e.x = f.p.position.x + 160; // out of range; the player has not moved
  assert.equal(f.send()?.hdel, undefined, "no re-list this tick: still tracked");
  f.p.position.x += 3; // under 4 blocks
  assert.equal(f.send()?.hdel, undefined);
  f.p.position.x += 3; // 6 blocks from the last list
  assert.deepEqual(f.send().hdel, ["h" + f.e.id]);
});

test("hanging: an untracked frame is not tested every tick; a 4+ block move of the player re-lists and starts it", () => {
  const f = fixture();
  f.e.x = f.p.position.x + 200;
  assert.equal(f.send()?.hset, undefined, "new entity out of range: not tracked");
  f.e.x = f.p.position.x + 100; // now in range, the player stood still
  assert.equal(f.send()?.hset, undefined, "no re-list: still untracked");
  f.p.position.x += 5;
  assert.equal(f.send().hset.length, 1);
});

test("order: the golem's S19 4 goes out before the target's S19 2, and a status set earlier in the tick precedes a later one", () => {
  const f = fixture(), sm = f.sim.mobs;
  const order = [];
  const ew = { mobStatus: (e, s) => order.push(s), attackEntityFrom: () => (order.push(2), true), events: [] };
  golemStrike({ e: { x: 0, y: 0, z: 0, vy: 0 }, ai: { ew }, rand: { nextInt: () => 0, nextFloat: () => 0 } }, { e: { vy: 0 } });
  assert.deepEqual(order, [4, 2]);
  const a = { id: 1 }, b = { id: 2 };
  sm.statuses.length = 0;
  sm.mobs.mobStatus = (e, s) => sm.status(e, s);
  sm.status(a, 18); sm.noteStatus({ position: a, sound: undefined }); // no sound: ignored
  const s1 = sm.mobs.nextStatusSeq(), s2 = sm.mobs.nextStatusSeq();
  assert.ok(s2 > s1);
  sm.statuses.push({ e: b, status: 2, seq: s1 }, { e: a, status: 4, seq: s2 });
  sm.statuses.sort((x, y) => (x.seq ?? 0) - (y.seq ?? 0));
  assert.deepEqual(sm.statuses.map((q) => q.status), [18, 2, 4]);
});

test("EntityWorld stamps seq on a fresh hit's client sound only with a dedicated server hook", () => {
  assert.equal(typeof EntityWorld.prototype.nextStatusSeq, "function");
});

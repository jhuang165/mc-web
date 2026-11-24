// Batch 99 mpobjects99: the dedicated server runs the batch 98 villager fixes through the shared EntityWorld; the End's joining snapshot uses live columns and the live lit set.
import test from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

await populationBlockMapperReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat(name) {
  const w = new World(name);
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
function fixture(name) {
  const s = new DedicatedSimulation({}, { world: flat(name), gameMode: "survival", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer("a", "Alice", key(1));
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("a", input());
  return { s, p };
}

test("a server villager that is traded with runs the look timer on the customer's view", () => {
  const { s, p } = fixture("b99-look");
  const mobs = s.mobs.mobs, v = mobs.create("villager", 66.5, 10, 64.5);
  mobs.entities.push(v);
  s.tick();
  assert.equal(s.trade.interact(p, v, mobs), true);
  assert.equal(v.customer, true);
  const brain = mobs.ai.brain(v);
  for (let i = 0; i < 4; i++) s.tick();
  const task = brain.tasks.entries.map((x) => x.action).find((t) => t.constructor.name === "LookAtTradePlayer");
  assert.ok(task, "task found");
  assert.ok(task.timer > 0 && task.timer <= 79, `timer ${task.timer}`);
  assert.ok(task.target && task.target.x === p.position.x, "the target is the connected player's view");
});

test("a server-born villager child takes the follow-range bonus and stands at yaw 0 (the shared spawnVillagerChild)", () => {
  const { s } = fixture("b99-child");
  const mobs = s.mobs.mobs, parent = mobs.create("villager", 66.5, 10, 64.5);
  parent.rotationYaw = 77;
  mobs.entities.push(parent);
  const child = mobs.spawnVillagerChild(parent);
  assert.equal(child.growingAge, -24000);
  assert.equal(child.rotationYaw, 0);
  assert.equal(child.modifiers.length, 1, "one follow-range spawn bonus");
  assert.ok(child.profession >= 0 && child.profession < 5);
  assert.ok(mobs.entities.includes(child));
});

test("a joining End player's snapshot carries the End's live columns and its live lit set", { timeout: 300000 }, () => {
  const { s, p } = fixture("b99-end");
  s.tick();
  s.dimensions.arrive(p, 1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const end = s.dimensions.end.n;
  assert.ok(end, "the End exists");
  end.redstone.lit.add("60,70,60");
  const seen = [];
  const columnsFor = s.chunkViews.columnsFor.bind(s.chunkViews);
  s.chunkViews.columnsFor = (id, world) => { seen.push(world); return columnsFor(id, world); };
  const snap = s.snapshot("a");
  assert.equal(snap.dimension, 1);
  assert.equal(snap.redstone.lit.includes("60,70,60"), true);
  assert.deepEqual(seen, [end.world], "columns come from the End's live world");
  assert.notEqual(end.world, s.world);
});

test("an iron golem's rose offer sends state 11 when it ends even though the counter is already 0 (EntityIronGolem.setHoldingRose always sends)", () => {
  const { s, p } = fixture("b99-rose");
  const mobs = s.mobs.mobs, g = mobs.spawnIronGolem(66.5, 10, 64.5, true);
  s.tick();
  const task = mobs.ai.brain(g).tasks.entries.map((x) => x.action).find((t) => t.constructor.name === "LookAtVillager");
  assert.ok(task, "the golem's LookAtVillager task");
  const statuses = () => { const out = (p.mobPackets ?? []).filter((k) => k.type === "mobStatus").map((k) => k.status); p.mobPackets = null; return out; };
  statuses();
  task.startExecuting();
  s.tick();
  assert.deepEqual(statuses(), [11], "the offer starts");
  s.tick(); s.tick();
  assert.deepEqual(statuses(), [], "the countdown is silent");
  g.holdRose = 2; s.tick(); statuses(); // set aside by the test, drained
  s.tick(); s.tick();
  assert.equal(g.holdRose, 0, "the counter ran out on its own");
  assert.deepEqual(statuses(), [], "and that was silent");
  task.resetTask();
  s.tick();
  assert.deepEqual(statuses(), [11], "the reset still sends state 11 (the client copy raises its arm for another 400 ticks, as natively)");
});

// Batch 97 mpobjects97: the tick message's redstone.lit is the lit set at mq.b's place (the flush), not the end of the tick; portal-arriving XP orbs take a fresh id from the server's orb counter.
import test from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { ServerPortalTravel } from "./multiplayer/server-portal-travel.js";
import { ExperienceOrbs } from "./experience.js";
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
function overworld(name) {
  const s = new DedicatedSimulation({}, { world: flat(name), gameMode: "survival", mobs: true });
  const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input("a", input());
  s.tick();
  return s;
}

test("Overworld: a cell that lights after the flush is in the NEXT tick's redstone.lit, with its block change", { timeout: 300000 }, () => {
  const s = overworld("b97-lit");
  const k = "70,10,70";
  const land = s.falling.tickEntities.bind(s.falling);
  let once = true;
  s.falling.tickEntities = () => { land(); if (once) { once = false; s.redstone.lit.add(k); } }; // the entity pass: after the flush
  s.input("a", input());
  const first = s.tick();
  assert.equal(first.redstone.lit.includes(k), false, "not yet in this tick's message");
  assert.equal(s.redstone.lit.has(k), true, "the server state has it at once");
  s.input("a", input());
  const second = s.tick();
  assert.equal(second.redstone.lit.includes(k), true, "in the next one");
  assert.equal(second.changes.some((c) => c[0] === 70 && c[1] === 10 && c[2] === 70), true, "with its S23");
});

test("Nether lane: redstone.lit is the flush moment's set", { timeout: 300000 }, () => {
  const s = new DedicatedSimulation({}, { world: flat("b97-nether"), gameMode: "creative", mobs: true });
  const a = s.addPlayer("a", "Alice", key(1));
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether, w = n.world;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) w.put(x, y, z, y === 69 ? 150 : 0, 0, false);
  const go = () => { s.input("a", input()); a.position.copy({ x: 64.5, y: 70, z: 64.5 }); s.tick(); return s.dimensions.alt[-1]; };
  go();
  const k = "60,70,60", land = n.falling.tickEntities.bind(n.falling);
  let once = true;
  n.falling.tickEntities = () => { land(); if (once) { once = false; n.redstone.lit.add(k); } };
  assert.equal(go().redstone.lit.includes(k), false);
  assert.equal(go().redstone.lit.includes(k), true);
});

test("a portal-arriving orb takes a fresh id: unique among every server orb, ascending", () => {
  const xp = new ExperienceOrbs([]);
  xp.spawn(5, { x: 1, y: 1, z: 1 }, true);
  const used = xp.orbs.map((o) => o.id);
  const fake = { dims: { state() {}, shots: { placed: (t) => ({ e: { x: 2, y: 3, z: 4, vx: 0, vy: 0, vz: 0 }, to: -1 }) } }, parts: () => ({ xp }) };
  for (let i = 0; i < 3; i++) ServerPortalTravel.prototype.arrive.call(fake, { kind: "orb", rec: { x: 0, y: 0, z: 0, value: 3, id: used[0] } });
  const ids = xp.orbs.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, "no collision, even with the saved id on the record");
  assert.deepEqual([...ids].sort((p, q) => p - q), ids, "ascending");
});

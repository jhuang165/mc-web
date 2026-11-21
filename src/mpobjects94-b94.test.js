// Batch 94 mpobjects94: the tail of WorldServer.tick (mt.b): block events after the random ticks, and the Overworld teleporter sweep before the Nether's trips.
// See .shared-memory/notes/mpobjects94-b94-track.md.
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
function sim(name) {
  const s = new DedicatedSimulation({}, { world: flat(name), gameMode: "survival", mobs: false });
  const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input("a", input());
  s.tick();
  return s;
}

test("a block event queued by the random ticks runs in the same tick (sendQueuedBlockEvents ends mt.b)", () => {
  const s = sim("b94-events");
  const ID = 250; // an original id that no block uses: the engine reads this cell as it
  const getBlock = s.redstone.getBlock.bind(s.redstone);
  s.redstone.getBlock = (x, y, z) => (x === 60 && y === 10 && z === 60 ? ID : getBlock(x, y, z));
  let hits = 0;
  s.redstone.registerBehaviour(ID, { onBlockEventReceived() { hits++; return true; } });
  const random = s.weather.tick.bind(s.weather);
  s.weather.tick = (...a) => { const r = random(...a); s.redstone.addBlockEvent(60, 10, 60, ID, 0, 0); return r; };
  s.tick();
  assert.equal(hits, 1, "the event queued after the random ticks ran before the entity pass of the same tick");
});

test("the block events flush follows the random ticks and the weather bolts, and precedes the entity pass", () => {
  const s = sim("b94-events-order");
  const log = [];
  const spy = (o, name, tag) => { const f = o[name].bind(o); o[name] = (...a) => { log.push(tag); return f(...a); }; };
  spy(s.redstone, "sendQueuedBlockEvents", "events"); spy(s.weather, "tick", "random"); spy(s.weather, "drain", "drain"); spy(s.mobs.mobs, "tick", "entities"); spy(s.fluids, "beginTick", "scheduled");
  s.tick();
  const at = (t) => log.indexOf(t);
  assert.ok(at("scheduled") < at("random") && at("random") < at("events") && at("events") < at("entities"), log.join());
  assert.equal(log.filter((t) => t === "events").length, 1);
});

test("the Overworld teleporter's sweep runs before a Nether player's portal check at a multiple of 100 ticks", () => {
  const s = sim("b94-sweep");
  s.dimensions.ensureNether();
  const t = s.dimensions.teleporterFor(0);
  const k = 12345;
  t.cache.set(k, { x: 1, y: 2, z: 3, time: -1000 }); t.keys.push(k); // unused for far more than 600 ticks
  const seen = [];
  const check = s.dimensions.checkPortal.bind(s.dimensions);
  s.dimensions.checkPortal = (p) => { if (s.ticks % 100 === 0) seen.push(t.cache.has(k)); return check(p); };
  while (s.ticks < 99) s.tick();
  assert.equal(t.cache.has(k), true, "still cached before the sweep tick");
  s.tick(); // ticks === 100
  assert.equal(s.ticks, 100);
  assert.deepEqual(seen, [false], "gone when the tick's portal checks (the entity pass) ran");
});

// Batch 93 mpobjects93: the dedicated server runs SpawnerAnimals right after the sleep skip (before tickPending, mt.b), and the scheduled block ticks of a dimension
// (fluids, fire, falling blocks, redstone) are taken from one shared tree in (time, priority, creation id) order. See .shared-memory/notes/mpobjects93-b93-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, WATER, SAND } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat(name) {
  const w = new World(name);
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
function sim(name, mobs = true) {
  const s = new DedicatedSimulation({}, { world: flat(name), gameMode: "survival", mobs });
  const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input("a", input());
  s.tick();
  return s;
}

test("SpawnerAnimals runs once, after the sleep skip and before the scheduled ticks", () => {
  const s = sim("b93-spawn");
  const log = [];
  const spy = (o, name, tag) => { const f = o[name].bind(o); o[name] = (...a) => { log.push(tag); return f(...a); }; };
  spy(s.sleep, "worldTick", "sleep"); spy(s.mobs, "spawnPass", "spawn"); spy(s.fluids, "beginTick", "fluids"); spy(s.redstone, "beginTick", "redstone"); spy(s.weather, "tick", "random"); spy(s.mobs.mobs, "tick", "entities");
  s.tick();
  const at = (t) => log.indexOf(t);
  assert.equal(log.filter((t) => t === "spawn").length, 1, "one pass per tick");
  assert.ok(at("sleep") >= 0 && at("sleep") < at("spawn"), "sleep check first");
  assert.ok(at("spawn") < at("fluids") && at("spawn") < at("redstone") && at("spawn") < at("random"), "before tickPending and the random ticks");
  assert.ok(at("spawn") < at("entities"));
});

test("a direct mobs.tick() still spawns when the world tick did not call spawnStep", () => {
  const s = sim("b93-direct");
  let n = 0; const f = s.mobs.spawnPass.bind(s.mobs); s.mobs.spawnPass = () => { n++; return f(); };
  s.mobs.tick();
  assert.equal(n, 1);
  s.mobs.spawnStep(); s.mobs.tick();
  assert.equal(n, 2, "spawnStep then tick: one pass, not two");
  s.mobs.tick();
  assert.equal(n, 3, "the skip lasts one tick");
});

test("a dimension's scheduled entries run from one tree: an earlier-created falling entry precedes a fluid entry due at the same time", () => {
  const s = sim("b93-tree", false);
  assert.ok(s.tickTree, "the tree is attached");
  assert.equal(s.fluids.ids, s.tickTree);
  assert.equal(s.falling.ids, s.tickTree);
  const log = [];
  for (const src of s.tickTree.sources) { const run = src.run; src.run = (e) => { log.push(src.name); return run(e); }; }
  s.world.put(70, 12, 70, SAND, 0, false); s.falling.schedule(70, 12, 70, SAND); // created first
  s.world.put(72, 10, 72, WATER, 0, false); s.fluids.added(72, 10, 72);
  const sand = [...s.falling.pending.values()][0], water = [...s.fluids.pending.values()][0];
  assert.ok(sand.id < water.id, "one counter numbers both kinds");
  water.time = sand.time; // the same due time, so only the creation id decides
  s.tick(); s.tick(); s.tick();
  const fall = log.indexOf("falling"), flow = log.indexOf("fluids");
  assert.ok(fall >= 0 && flow >= 0, log.join());
  assert.ok(fall < flow, "creation order across kinds (the old system-by-system pass ran fluids first)");
});

test("the Nether and End build the same tree and spawn before the scheduled pass (source pin)", () => {
  const n = src("./multiplayer/server-nether.js");
  assert.ok(n.includes("n.tickTree = attachTickTree("));
  assert.ok(n.indexOf("n.mobs.spawnStep()") < n.indexOf("tickScheduledSystems("));
  assert.ok(n.includes("tickTree: n.tickTree"));
});

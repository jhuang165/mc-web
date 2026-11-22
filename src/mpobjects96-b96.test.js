// Batch 96 mpobjects96: the Nether / End lanes flush their block changes at mq.b's place (before the entity pass), and the village tick sits where mt.b runs it
// (after mq.b, before the block events and the entity pass). See .shared-memory/notes/mpobjects96-b96-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { populationBlockMapperReady } from "./population-world.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

await populationBlockMapperReady;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const has = (msg, x, y, z) => (msg?.changes ?? []).some((c) => c[0] === x && c[1] === y && c[2] === z);
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
function nether() {
  const s = new DedicatedSimulation({}, { world: flat("b96-nether"), gameMode: "creative", mobs: true });
  const a = s.addPlayer("a", "Alice", key(1));
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether, w = n.world;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) w.put(x, y, z, y === 69 ? 150 : 0, 0, false);
  n.changes.clear();
  const go = () => { s.input("a", input()); a.position.copy({ x: 64.5, y: 70, z: 64.5 }); return s.tick(); };
  go();
  return { s, n, w, go };
}

test("Nether lane: a change made in the entity pass goes out in the NEXT tick's message; the random ticks' change in this one", { timeout: 300000 }, () => {
  const { s, n, w, go } = nether();
  const land = n.falling.tickEntities.bind(n.falling);
  const random = n.weather.tickDimension.bind(n.weather);
  let early = true, late = true;
  n.weather.tickDimension = (...a) => { const r = random(...a); if (early) { early = false; w.put(60, 70, 60, 1, 0); } return r; };
  n.falling.tickEntities = () => { land(); if (late) { late = false; w.put(61, 70, 61, 1, 0); } };
  const first = (go(), s.dimensions.alt[-1]);
  assert.equal(has(first, 60, 70, 60), true, "random-tick change in this tick's message");
  assert.equal(has(first, 61, 70, 61), false, "entity-pass change not in it");
  assert.equal(w.get(61, 70, 61), 1, "the world has it at once");
  const second = (go(), s.dimensions.alt[-1]);
  assert.equal(has(second, 61, 70, 61), true, "in the next flush");
  assert.equal(has((go(), s.dimensions.alt[-1]), 61, 70, 61), false, "sent once");
});

test("Nether lane: the village tick runs once per tick, after the flush and before the block events and the entity pass", { timeout: 300000 }, () => {
  const { n, go } = nether();
  const log = [], ew = n.mobs.mobs;
  const vt = ew.villages.tick.bind(ew.villages), st = ew.siege.tick.bind(ew.siege), mt = n.mobs.tick.bind(n.mobs), fl = n.falling.tickEntities.bind(n.falling);
  ew.villages.tick = () => { log.push("village"); return vt(); };
  ew.siege.tick = () => { log.push("siege"); return st(); };
  n.mobs.tick = () => { log.push("mobs"); return mt(); };
  n.falling.tickEntities = () => { log.push("entities"); return fl(); };
  go();
  assert.deepEqual(log, ["village", "siege", "mobs", "entities"]);
});

test("Overworld: VillageCollection / VillageSiege run once per tick before the block events, so a block event's door change is seen next tick", () => {
  const s = overworld("b96-village");
  const log = [], ew = s.mobs.mobs;
  const vt = ew.villages.tick.bind(ew.villages), st = ew.siege.tick.bind(ew.siege);
  ew.villages.tick = () => { log.push(`village:${s.world.get(62, 10, 62)}`); return vt(); };
  ew.siege.tick = () => { log.push("siege"); return st(); };
  const getBlock = s.redstone.getBlock.bind(s.redstone);
  s.redstone.getBlock = (x, y, z) => (x === 60 && y === 10 && z === 60 ? 250 : getBlock(x, y, z));
  s.redstone.registerBehaviour(250, { onBlockEventReceived() { log.push("event"); s.world.put(62, 10, 62, 1, 0); return true; } });
  const random = s.weather.tick.bind(s.weather);
  let hook = false;
  s.weather.tick = (...a) => { const r = random(...a); if (!hook) { hook = true; s.redstone.addBlockEvent(60, 10, 60, 250, 0, 0); } return r; };
  s.input("a", input()); s.tick();
  assert.deepEqual(log, ["village:0", "siege", "event"], "the village tick saw the cell before the event changed it");
  log.length = 0;
  s.input("a", input()); s.tick();
  assert.deepEqual(log, ["village:1", "siege"], "and sees it the next tick, once");
});

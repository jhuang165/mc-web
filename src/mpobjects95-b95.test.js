// Batch 95 mpobjects95: the chunk-update flush (mq.b, PlayerManager.updatePlayerInstances) sits after the random ticks and before the entity pass of mt.b / updateEntities.
// See .shared-memory/notes/mpobjects95-b95-track.md.
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

const has = (msg, x, y, z) => (msg.changes ?? []).some((c) => c[0] === x && c[1] === y && c[2] === z);

test("a change made by the random ticks goes out in the same tick's flush", () => {
  const s = sim("b95-before");
  const random = s.weather.tick.bind(s.weather);
  s.weather.tick = (...a) => { const r = random(...a); s.world.put(60, 10, 60, 1, 0); return r; };
  const msg = s.tick();
  assert.ok(has(msg, 60, 10, 60), "random-tick change in this tick's message");
});

test("a change made in the entity pass (falling block landing, mob grief) goes out in the NEXT tick's flush", () => {
  const s = sim("b95-after");
  const land = s.falling.tickEntities.bind(s.falling);
  let once = true;
  s.falling.tickEntities = () => { land(); if (once) { once = false; s.world.put(61, 10, 61, 1, 0); } };
  const first = s.tick();
  assert.equal(has(first, 61, 10, 61), false, "not in the tick whose entity pass made it");
  const second = s.tick();
  assert.equal(has(second, 61, 10, 61), true, "in the next flush");
  const third = s.tick();
  assert.equal(has(third, 61, 10, 61), false, "sent once");
});

test("a block event's change (piston finishing) also waits for the next flush; the world and the light see it at once", () => {
  const s = sim("b95-events");
  const getBlock = s.redstone.getBlock.bind(s.redstone);
  s.redstone.getBlock = (x, y, z) => (x === 60 && y === 10 && z === 60 ? 250 : getBlock(x, y, z));
  const random = s.weather.tick.bind(s.weather);
  let hook = false;
  s.weather.tick = (...a) => { const r = random(...a); if (!hook) { hook = true; s.redstone.addBlockEvent(60, 10, 60, 250, 0, 0); } return r; };
  s.redstone.registerBehaviour(250, { onBlockEventReceived() { s.world.put(62, 10, 62, 1, 0); return true; } });
  const first = s.tick();
  assert.equal(s.world.get(62, 10, 62), 1, "applied this tick");
  assert.equal(has(first, 62, 10, 62), false);
  assert.equal(has(s.tick(), 62, 10, 62), true);
});

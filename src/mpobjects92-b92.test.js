// Batch 92 mpobjects92: the dedicated server's world pass follows mt.b / ahb.h (weather timers, all-asleep skip, scheduled tickUpdates + block events, random ticks, entities, tile
// entities, tracker flush), and a mob spawned in the turn another entity is removed still joins the pass. See .shared-memory/notes/mpobjects92-b92-track.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
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

test("a server tick: weather timers, sleep skip, scheduled ticks, random ticks, entities, tile entities, then the tracker flush", () => {
  const s = new DedicatedSimulation({}, { world: flat("b92-order"), gameMode: "survival", mobs: false });
  const p = s.addPlayer("a", "ax", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  s.input("a", input());
  s.tick();
  const log = [];
  const spy = (o, name, tag) => { const f = o[name].bind(o); o[name] = (...a) => { log.push(tag); return f(...a); }; };
  spy(s.weather, "updateWeather", "timers"); spy(s.sleep, "worldTick", "sleep"); spy(s.fluids, "tick", "fluids"); spy(s.fire, "tick", "fire");
  spy(s.redstone, "tickUpdates", "redstone"); spy(s.redstone, "updateTileEntities", "tiles"); spy(s.falling, "tickEntities", "fallingEntities");
  spy(s.weather, "tick", "random"); spy(s.mobs, "tick", "mobs"); spy(s.dispense, "flush", "flush"); spy(s.pistons, "flush", "pistons");
  const hop = s.containers.ticks.hoppers; spy(hop, "tick", "hoppers");
  s.tick();
  const at = (t) => log.indexOf(t);
  for (const t of ["timers", "sleep", "fluids", "fire", "redstone", "random", "mobs", "hoppers", "tiles", "flush"]) assert.ok(at(t) >= 0, t);
  assert.ok(at("timers") < at("sleep") && at("sleep") < at("fluids"), "the all-asleep skip follows the weather timers and precedes tickPending");
  assert.ok(at("fire") < at("redstone") && at("redstone") < at("random"), "scheduled tickUpdates precede the random block ticks");
  assert.ok(at("random") < at("mobs"));
  assert.ok(at("mobs") < at("hoppers") && at("hoppers") < at("tiles"), "tile entities come after the entities");
  assert.ok(at("tiles") < at("flush") && at("flush") < at("pistons"), "tile entities update before the tracker pass");
  assert.equal(log.filter((t) => t === "random").length, 1);
});

test("the sleep skip moves the clock before the darkness the next spawner reads is captured", () => {
  const s = new DedicatedSimulation({}, { world: flat("b92-sleep"), gameMode: "survival", mobs: false });
  const p = s.addPlayer("a", "ax", key(2)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("a", input());
  s.time = 15000; s.tick();
  s.sleep.allAsleep = () => true; s.sleep.overworld = () => [];
  s.tick();
  assert.ok(s.time % 24000 < 100, "skipped to the morning");
  assert.equal(s.spawnDarkness, s.darkness, "the capture is the post-skip skylight (mt.b computes it after the skip)");
});

test("the Nether runs its scheduled ticks before the random ticks and its tile entities after the entity pass (source pin)", () => {
  const n = src("./multiplayer/server-nether.js");
  assert.ok(n.indexOf("tickScheduledSystems(") < n.indexOf("n.weather.tickDimension("));
  assert.ok(n.indexOf("n.mobs.tick()") < n.indexOf("tickTileSystems(") && n.indexOf("tickTileSystems(") < n.indexOf("n.dispense.flush();"));
});

test("a mob spawned in the turn another entity is removed still updates in that pass", { timeout: 180000 }, () => {
  const s = new DedicatedSimulation({}, { world: flat("b92-adopt"), gameMode: "creative", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer("p", "px", key(3)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("p", input());
  const ew = s.mobs.mobs;
  const a = ew.create("pig", 66.5, 10, 70.5), gone = ew.create("pig", 60.5, 10, 70.5);
  ew.entities.push(a, gone);
  for (let k = 0; k < 3; k++) s.tick();
  let baby = null;
  const hook = ew.beforeMob;
  ew.beforeMob = (e) => {
    hook?.call(ew, e);
    if (!baby && e === a) { // the removal and the spawn leave the list the same length
      ew.entities.splice(ew.entities.indexOf(gone), 1); gone.dead = true;
      baby = ew.create("pig", 68.5, 10, 70.5); ew.entities.push(baby);
    }
  };
  s.tick();
  assert.ok(baby);
  assert.equal(baby.age, 1, "its first update ran in the tick that made it");
  ew.beforeMob = hook;
});

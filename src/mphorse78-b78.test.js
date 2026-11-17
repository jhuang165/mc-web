// Batch 78 mphorse78: server horse leftovers. Native reads: EntityHorse.c() (watcher ids 16, 19, 20, 21, 22: no temper), wi.a(ro, F) with ro.j() (an arrow's shooter),
// MinecraftServer.stopServer (saveAllPlayerData, removeAllPlayers, saveAllWorlds), oi.e / oi.a(ej, mw).
import test from "node:test";
import assert from "node:assert/strict";
import { makeSide, spawn, serverClick } from "../tools/sweep-use75.mjs";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { World } from "./world.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { Survival } from "./survival.js";
import { makeStack } from "./inventory.js";
import { predictAnimalUse } from "./multiplayer/animal-use.js";
import { mobState } from "./multiplayer/server-mobs.js";
import { Arrows as ArrowSystem } from "./bow.js";

const tick = (s, n = 1) => { for (let i = 0; i < n; i++) s.tick(); };
function ridden(side) {
  const e = spawn(side, "horse"); Object.assign(e.horse, { tame: true, saddled: true, type: 0, speed: 0.3, jump: 0.7 }); e.health = 30; e.growingAge = 0; e.onGround = true;
  side.p.survival.inventory.main[0] = null; serverClick(side, e); tick(side.s, 2);
  assert.ok(side.p.mount?.mob === e);
  return e;
}
const WHEAT = 305; // live item id (originalId maps it to 296)
const held = (id) => { const s = new Survival({}, "survival"); s.inventory.main[0] = makeStack(id, 3, 0); s.inventory.current = 0; return s; };
const stand = (horse, health = 30) => ({ type: "horse", health, growingAge: 0, love: 0, horse: { ...horse } });

test("the wire carries no temper, and the copy does not guess it for a wild horse", () => {
  const side = makeSide(), e = spawn(side, "horse");
  e.horse.temper = 100; e.growingAge = 0; e.health = 30;
  assert.ok(!("temper" in mobState(e).horse), "temper is not a watched value");
  // wild, full health, adult: wheat only matters through temper, which the copy cannot know
  const wild = stand({ tame: false, maxHealth: 30, type: 0, variant: 0 }), s = held(WHEAT);
  assert.equal(predictAnimalUse(wild, s, { selfId: "a" })?.handled ?? false, false);
  assert.equal(s.inventory.main[0].count, 3, "no item is spent on a guess");
  assert.equal(wild.horse.temper, undefined, "no temper is written to the copy");
  // a wild horse the feed heals is still predicted; the temper stays unwritten
  const hurt = stand({ tame: false, maxHealth: 30, type: 0, variant: 0 }, 20), s2 = held(WHEAT);
  assert.equal(predictAnimalUse(hurt, s2, { selfId: "a" }).handled, true);
  assert.equal(s2.inventory.main[0].count, 2); assert.equal(hurt.health, 22); assert.equal(hurt.horse.temper, undefined);
});

test("a rider's own arrow is refused by its horse and ricochets; another shooter's arrow hurts", () => {
  const side = makeSide(), e = ridden(side), m = side.s.mobs.mobs, arrows = new ArrowSystem();
  const own = { shooter: "player", owner: side.p, fire: 0 }, hp = e.health;
  assert.equal(arrows.damageTarget(own, e, 6, { mobs: m }), false);
  assert.equal(e.health, hp);
  const other = { shooter: "player", owner: { mount: null }, fire: 0 };
  assert.equal(arrows.damageTarget(other, e, 6, { mobs: m }), true);
  assert.ok(e.health < hp);
});

test("a server shutdown keeps the horse in the world and also saves Riding", () => {
  const side = makeSide(), e = ridden(side), m = side.s.mobs.mobs, key = side.p.resumeKey;
  side.s.shuttingDown = true;
  side.s.removePlayer("a");
  assert.ok(m.entities.includes(e), "the horse stays");
  assert.equal(e.rider ?? null, null, "but no one rides it");
  assert.equal(side.s.savedPlayers.get(key).riding.type, "horse");
});

test("a rider who logs out in the Nether is remounted in the Nether", () => {
  const w = new World("b78"); w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world: w, gameMode: "creative", mobs: true });
  s.rules.chunkStream = false;
  const a = s.addPlayer("a", "Alice", "b78-key-a");
  s.dimensions.arrive(a, -1, { at: { x: 64.5, y: 70, z: 64.5 } });
  const n = s.dimensions.nether, nw = n.world;
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 60; y <= 90; y++) nw.put(x, y, z, y === 69 ? 150 : 0, 0, false);
  s.input("a", { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  const nm = n.mobs.mobs; nm.entities.length = 0;
  const e = nm.create("horse", 65.5, 70, 64.5);
  Object.assign(e.horse, { tame: true, saddled: true, type: 0, speed: 0.3, jump: 0.7 }); e.health = 30; e.growingAge = 0; nm.entities.push(e);
  assert.equal(s.dimensions.within(a, () => s.vehicles.horses.mount(a, e)), true);
  assert.ok(a.mount?.mob === e);
  s.removePlayer("a");
  assert.ok(!nm.entities.includes(e), "the Nether horse left the Nether");
  const saved = s.savedPlayers.get("b78-key-a");
  assert.equal(saved.dimension, -1); assert.equal(saved.riding?.type, "horse");
  const p2 = s.addPlayer("b", "Alice", "b78-key-a");
  assert.equal(p2.dimension, -1);
  assert.ok(p2.mount?.mob && nm.entities.includes(p2.mount.mob), "remounted on a Nether horse");
  assert.equal(p2.mount.mob.rider, p2.mount.rider);
});

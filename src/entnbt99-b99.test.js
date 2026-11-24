// Batch 99 entnbt99: F3 ability speeds, the XP bar width for odd XpP (bytecode-read bbv), and the dedicated server's ability speeds, raw XP and vitals round trip.
import test from "node:test";
import assert from "node:assert/strict";
import { xpBarCap, xpBarFill, Experience } from "./experience.js";
import { setAbilitySpeeds, shownAbilitySpeeds, normalAbilitySpeeds, flySpeed, moveSpeed } from "./player-movement.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { World } from "./world.js";

const f = Math.fround;
test("F3 speeds come from the loaded abilities", () => {
  setAbilitySpeeds({ fly: 0.2, walk: 0.3 });
  assert.deepEqual(shownAbilitySpeeds(), { walk: f(0.3), fly: f(0.2) });
  setAbilitySpeeds({ fly: 0.05, walk: -0.5 });
  assert.equal(shownAbilitySpeeds().walk, f(-0.5)); // raw capability; the movement attribute clamps at 0
  assert.equal(moveSpeed(false), 0);
  setAbilitySpeeds(undefined);
  assert.deepEqual(shownAbilitySpeeds(), { walk: f(0.1), fly: f(0.05) });
});

test("xp bar fill follows (int)(xpP * 183F) drawn only above 0", () => {
  assert.equal(xpBarFill(0.5, 3), 91);
  assert.equal(xpBarFill(1, 3), 183);
  assert.equal(xpBarFill(0, 3), 0);
  assert.equal(xpBarFill(NaN, 3), 0);
  assert.equal(xpBarFill(-0.4, 3), 0);
  assert.equal(xpBarFill(2, 3), 366);
  assert.equal(xpBarFill(Infinity, 3), 2147483647);
  assert.equal(xpBarFill(-Infinity, 3), 0);
});

test("xp bar cap wraps like the native int arithmetic", () => {
  assert.deepEqual([0, 14, 15, 29, 30, 31].map(xpBarCap), [17, 17, 17, 59, 62, 69]);
  assert.ok(xpBarCap(1000000000) < 0); // bar not drawn at all
  assert.equal(xpBarFill(0.5, 1000000000), 0);
});

function sim(saved = {}) {
  const world = new World("entnbt99");
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 20; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation(saved, { world, gameMode: "survival" });
}
const key = "00000000-0000-0000-0000-000000000001";
function walked(speeds, sprint = false) {
  const s = sim(speeds ? { players: [[key, { position: { x: 50.5, y: 10, z: 64.5 }, yaw: 0, pitch: 0, abilitySpeeds: speeds }]] } : {});
  const p = s.addPlayer("a", "A", key); p.position.copy({ x: 50.5, y: 10, z: 64.5 });
  for (let i = 0; i < 20; i++) { p.input = { forward: 1, strafe: 0, jump: false, sneak: false, sprint }; p.lastInput = s.ticks; s.tick(); }
  return Math.hypot(p.position.x - 50.5, p.position.z - 64.5);
}
test("server movement uses the loaded walkSpeed", () => {
  const base = walked(null), fast = walked({ fly: 0.05, walk: 0.2 }), still = walked({ fly: 0.05, walk: 0 });
  assert.ok(base > 0.5);
  assert.ok(fast > base * 1.5, `${fast} vs ${base}`);
  assert.ok(still < base * 0.5, `${still} vs ${base}`);
});

test("server save keeps ability speeds, raw XP and non-finite vitals through JSON", () => {
  const s = sim({ players: [[key, { position: { x: 50.5, y: 10, z: 64.5 }, yaw: 0, pitch: 0, abilitySpeeds: { fly: 0.2, walk: 0.3 },
    experience: { total: 5, score: 0, level: 3, progress: "NaN" }, player: { saturation: "Infinity", exhaustion: "-Infinity", health: "NaN" } }]] });
  const p = s.addPlayer("a", "A", key);
  assert.equal(flySpeed(p.abilitySpeeds), f(0.2));
  assert.ok(Number.isNaN(p.experience.progress) && p.experience.level === 3);
  const back = JSON.parse(JSON.stringify(s.savePlayer(p)));
  assert.deepEqual(back.abilitySpeeds, { fly: f(0.2), walk: f(0.3) });
  assert.equal(back.experience.progress, "NaN");
  assert.equal(back.player.saturation, "Infinity");
  assert.equal(back.player.exhaustion, "-Infinity");
  assert.equal(back.player.health, "NaN");
  const again = s.addPlayer("b", "B", "00000000-0000-0000-0000-000000000002");
  assert.equal(again.abilitySpeeds, undefined); // a fresh player has no loaded speeds and no saved field
  assert.equal(s.savePlayer(again).abilitySpeeds, undefined);
});

test("a non-finite speed is ignored (deliberate divergence: native NaN stays NaN, infinity clamps to Double.MAX_VALUE)", () => {
  assert.deepEqual(normalAbilitySpeeds({ fly: NaN, walk: Infinity }), { fly: f(0.05), walk: f(0.1), shownWalk: f(0.1) });
});

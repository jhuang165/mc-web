// Batch 54 digabort: the client's C07 status 1 (PlayerControllerMP.resetBlockRemoving) reaches the server dig timer (ItemInWorldManager.cancelDestroyingBlock,
// src/server-dig.js; executed records: da-* in public/research/dig-finish-reference.json, replayed by dig-finish-b53.test.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { Farming } from "./farming.js";
import { Trees } from "./trees.js";
import { JavaRandom } from "./java-random.js";
import { applyPlayerEdit } from "./player-edit-simulation.js";

const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const A = [42, 12, 42], B = [44, 12, 42];

function fixture() {
  const world = new World("b54-digabort");
  for (const p of [A, B]) { world.set(...p, 3, false, 0); world.set(p[0], p[1] + 1, p[2], 0, false, 0); }
  world.set(46, 12, 42, 31, false, 0); world.set(46, 13, 42, 0, false, 0); // tall grass: instant
  const survival = new Survival({ food: 10, slots: [] }, "survival");
  const state = {
    screen: "playing", heldTool: 0, world, survival, position: { x: 10.5, y: 10, z: 10.5 }, velocity: { x: 0, y: 0, z: 0 },
    motion: { sneaking: false, sprinting: false }, mobs: {}, farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(18) }), fire: {},
    grounded: true, fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null, mineCooldown: 0, mineHeld: true,
    flowers: {}, boneRandom: new JavaRandom(21), itemRand: new JavaRandom(22),
  };
  const log = [], hooks = { serverTask: (fn) => fn(), digStart: (c) => log.push("start " + c), digAbort: () => log.push("abort") };
  const click = (p) => applyPlayerEdit(state, { target: { block: [...p], adjacent: [p[0], p[1] + 1, p[2]] } }, hooks);
  return { state, log, click };
}

test("a dig start while another dig is under way sends the abort first and clears the stale dig", () => {
  const f = fixture();
  f.click(A);
  assert.deepEqual(f.log, ["start 42,12,42"]);
  f.click(B);
  assert.deepEqual(f.log, ["start 42,12,42", "abort", "start 44,12,42"]);
  assert.deepEqual(f.state.mining.block, B);
  f.click([46, 12, 42]); // an instant block while digging B: abort, then the start (no dig state follows)
  assert.deepEqual(f.log.slice(3), ["abort", "start 46,12,42"]);
  assert.equal(f.state.mining, null);
});

test("the same block and tool keeps digging without a packet", () => {
  const f = fixture();
  f.click(A); f.click(A);
  assert.deepEqual(f.log, ["start 42,12,42"]);
});

test("main.js watches the client dig: an unfinished stop sends the abort, a finish does not", () => {
  assert.match(main, /function watchClientDig\(\) \{\s*if \(watchedDig && mining !== watchedDig\) \{ if \(!watchedDig\.finished\) digAbortPacket\(\)/);
  assert.match(main, /function digAbortPacket\(\) \{ watchedDig = null; serverTask\(\(\) => serverDig\.abort\(\)\); \}/);
  assert.match(main, /function breakBlockPacket\(p, creative = false, accept = null\) \{\s*if \(accept && watchedDig\) watchedDig\.finished = true;/);
  assert.match(main, /mineCooldown = state\.cooldown;\s*watchClientDig\(\);/);
});

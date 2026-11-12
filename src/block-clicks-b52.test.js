// Batch 52 digstart: the server half of a dig start (ItemInWorldManager.onBlockClicked: dragon egg, note block, redstone ore) joins the network-tick
// queue, and a queued dig finish re-reads the block at the cell. Bytecode-read: PlayerControllerMP.clickBlock (bje.b) sends C07 status 0 and only
// the client's own part (the creative / instant destroy on the client world, the dig state) runs at once. The earlier "held dig never breaks" was a
// harness mistake: the port's internal ids are 1 = dirt, 3 = stone, so a held bare hand on id 3 needs 150 ticks (7.5 s), as on stone natively.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { Survival } from "./survival.js";
import { Farming } from "./farming.js";
import { Trees } from "./trees.js";
import { JavaRandom } from "./java-random.js";
import { applyPlayerEdit } from "./player-edit-simulation.js";
import { tickPlayerMining } from "./player-mining.js";
import { DRAGON_EGG } from "./dragon-egg.js";
import { REDSTONE_ORE, LIT_REDSTONE_ORE } from "./world.js";

const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const POS = [42, 12, 42];

function fixture(block) {
  const world = new World("b52-digstart");
  world.set(...POS, block, false, 0);
  world.set(POS[0], POS[1] + 1, POS[2], 0, false, 0);
  const survival = new Survival({ food: 10, slots: [] }, "survival");
  const state = {
    screen: "playing", heldTool: 0, world, survival, position: { x: 10.5, y: 10, z: 10.5 }, velocity: { x: 0, y: 0, z: 0 },
    motion: { sneaking: false, sprinting: false }, mobs: {}, farming: new Farming(world), trees: new Trees(world, { random: new JavaRandom(18) }), fire: {},
    grounded: true, fallDistance: 0, wasInWater: false, yaw: 0, eating: null, mining: null, mineCooldown: 0, mineHeld: true,
    flowers: {}, boneRandom: new JavaRandom(21), itemRand: new JavaRandom(22),
  };
  return { state, request: { target: { block: [...POS], adjacent: [POS[0], POS[1] + 1, POS[2]] } } };
}

test("b52: dig start with a serverTask hook queues the dragon egg, note and ore effects instead of running them", () => {
  for (const [block, hookName] of [[DRAGON_EGG, "useDragonEgg"], [177, "blockClicked"], [REDSTONE_ORE, "touchRedstoneOre"], [LIT_REDSTONE_ORE, "touchRedstoneOre"]]) {
    const f = fixture(block), calls = [], queue = [];
    applyPlayerEdit(f.state, f.request, { [hookName]: (...a) => calls.push([hookName, ...a]), serverTask: fn => queue.push(fn) });
    assert.deepEqual(calls, [], `${hookName} waits for the network tick`);
    assert.equal(queue.length, 1);
    queue.shift()();
    assert.deepEqual(calls, [[hookName, ...POS]], `${hookName} runs when the queue is replayed`);
  }
});

test("b52: the queued click reads the block at the cell when it runs, as the server does", () => {
  const f = fixture(177), calls = [], queue = [];
  applyPlayerEdit(f.state, f.request, { blockClicked: () => calls.push("note"), serverTask: fn => queue.push(fn) });
  f.state.world.set(...POS, 1, false, 0); // the note block was replaced before the packet was handled
  queue[0]();
  assert.deepEqual(calls, []);
});

test("b52: without a serverTask hook the effect runs at once (multiplayer, replays, existing callers)", () => {
  const f = fixture(177), calls = [];
  applyPlayerEdit(f.state, f.request, { blockClicked: (...a) => calls.push(a) });
  assert.deepEqual(calls, [POS]);
});

test("b52: a plain block starts no server task", () => {
  const f = fixture(1), queue = [];
  const r = applyPlayerEdit(f.state, f.request, { serverTask: fn => queue.push(fn) });
  assert.equal(r.branch, "start-mining");
  assert.equal(queue.length, 0);
});

test("b52: a finished survival dig reports the dug type to the break hook", () => {
  const calls = [], mining = { block: [...POS], type: 1, progress: 0.99, tool: 0, auto: false };
  tickPlayerMining({ playing: true, mineHeld: true, target: { block: [...POS] }, aimedEntity: null, mining, cooldown: 0, survival: new Survival({ food: 10, slots: [] }, "survival"), heldTool: 0, grounded: true },
    { getBlock: () => 1, breakBlock: (p, c, type) => calls.push([p, c, type]) });
  assert.deepEqual(calls, [[POS, false, 1]]);
});

test("b52 main.js: dig-start effects are queued and the finish re-checks the block", () => {
  assert.match(main, /function serverTask\(fn\) \{\n\s+if \(runningEdits \|\| !mobs \|\| multiplayer\) \{ fn\(\); return; \}\n\s+pendingEdits\.push\(\{ fn \}\);/);
  assert.match(main, /breakBlock: breakBlockPacket,\n\s+clientEyeInWater,\n\s+serverTask,/);
  assert.match(main, /breakBlock: \(p, c, type\) => breakBlockPacket\(p, c, \(\) => \(type === undefined \|\| world\.get\(p\[0\], p\[1\], p\[2\]\) === type\) && serverClick/);
});

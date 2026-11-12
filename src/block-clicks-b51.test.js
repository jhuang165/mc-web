// Batch 51: block right clicks (C08) and digs (C07) join the C02 queue of batch 50 and run in the network tick, in arrival order.
// Bytecode-read: MinecraftServer.updateTimeLightAndEntities runs, per world, tick / updateEntities / tracker, and only after the worlds
// the "connection" section (NetworkSystem.networkTick), then "players" and "tickables".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const fnBody = (name) => main.match(new RegExp(`function ${name}\\([^)]*\\) \\{[^]*?\\n\\}\\n`))?.[0] ?? "";

test("batch 51: a click on a block, and any click behind a queued action, waits for the network tick", () => {
  const body = fnBody("defersToNetworkTick");
  assert.match(body, /aimedEntity \|\| aimedCart \|\| aimedHanging\) return true/);
  assert.match(body, /pendingEdits\.length\) return true/);
  assert.match(body, /place && target\) return true/);
  assert.ok(body.indexOf("pendingEdits.length") < body.indexOf("isThrowable"), "arrival order is checked before the item rules");
});

test("batch 51: the queue keeps the click's own target and replays entries in arrival order", () => {
  assert.match(main, /pendingEdits\.push\(\{ place, aimed: \[aimedEntity, aimedCart, aimedHanging\], target, predicted: .*\}\)/);
  const run = fnBody("runPendingEdits");
  assert.match(run, /for \(const q of list\) \{[^]*?if \(q\.fn\) \{ q\.fn\(\); continue; \}[^]*?target = q\.target;[^]*?edit\(q\.place\)/);
  assert.match(run, /target = wasTarget/);
});

test("batch 51: a finished dig (survival, creative or instant) is queued as a C07 and the server's range check runs when it is handled", () => {
  const body = fnBody("breakBlockPacket");
  assert.match(body, /pendingEdits\.push\(\{ fn: /);
  assert.match(body, /runningEdits[^]*?return/);
  assert.match(main, /breakBlock: \(p, c(?:, type)?\) => breakBlockPacket\(p, c, \(\) => type === undefined \|\| serverFinishDig\(p\)\)/);
  assert.match(fnBody("serverFinishDig"), /serverClick\(\{ kind: 'dig'/);
  assert.match(main, /breakBlock: breakBlockPacket,\n\s+clientEyeInWater/);
});

test("batch 51: the walk's afterEntities hook still runs the queue after the piston pass, and the tick end flushes the rest", () => {
  assert.match(main, /mobs\.afterEntities = \(\) => \{ tiles\(\); tickServerDig\(\); runPendingEdits\(\); \}/);
  assert.match(main, /runPendingEdits\(\); \/\/ no-ops when the walk already ran them\n\s+serverDigTicked = false;\n\s+redstoneRuntime\?\.tickTiles\(\)/);
});

// Batch 50: a player's attack, use and throw packets (C02 / C08 / C07) run in the network tick, after the worlds' entity walk of the same server tick
// (MinecraftServer.updateTimeLightAndEntities, bytecode-read). The live frame queues them and runs them from the walk's afterEntities hook.
// /kill and outOfWorld damage leave no recentlyHit. Executed: tools/probes/EntityListProbe.java b50mo-* (the real EntityCow, a player shell attacker).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { entityListReference, replayEntityList, entityListDivergence } from "./entity-list-replay.js";
import { EntityWorld } from "./entities.js";
import { World } from "./world.js";

const rec = (n) => entityListReference.find((r) => r.name === n);
const NAMES = entityListReference.filter((r) => r.name.startsWith("b50mo-")).map((r) => r.name);

test("batch 50 (executed records): five scenarios replay exactly", () => {
  assert.equal(NAMES.length, 5);
  for (const n of NAMES) assert.equal(entityListDivergence(rec(n), replayEntityList(rec(n))), null, n);
});

test("batch 50 (executed records): a hit landing after the walk lists its drops behind a cow that died in the walk; before the walk, ahead of it", () => {
  const post = rec("b50mo-hit-post-walk-death").rows[13][3], pre = rec("b50mo-hit-pre-walk-death").rows[13][3];
  assert.equal(post[0][0], 0.253860205411911, "the walker's drops (x 0.25) come first after the walk");
  assert.equal(post.at(-1)[0], 2.5, "the hit cow's drops (x 2.5) last");
  assert.equal(pre[0][0], 2.253860205411911, "a hit before the walk lists the hit cow's drops first");
  assert.notEqual(post[0][0], pre[0][0]);
});

test("batch 50 (executed record): outOfWorld damage leaves no experience orb", () => {
  assert.ok(rec("b50mo-outofworld-no-xp").rows.every((r) => r[2].length === 0));
});

test("batch 50: EntityWorld.kill is outOfWorld damage with no attacker: no recentlyHit, so no experience; a player's recent hit still counts", () => {
  const flat = new World(1);
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) flat.set(x, 0, z, 1);
  const w = new EntityWorld(flat, []), cow = w.create("cow", 64, 1, 64);
  w.entities.push(cow);
  w.kill(cow);
  assert.equal(cow.health, 0);
  assert.equal(cow.recentlyHit, 0);
  const hit = w.create("cow", 70, 1, 64);
  w.entities.push(hit);
  w.damage(hit, 1, 63, 64, true);
  assert.equal(hit.recentlyHit, 100);
  w.kill(hit);
  assert.equal(hit.health, 0);
  assert.equal(hit.recentlyHit, 100);
});

test("batch 50: main.js queues entity-aimed and entity-spawning actions for the afterEntities hook, chained after the piston tile pass", () => {
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /function defersToNetworkTick\(place\)/);
  assert.match(main, /function clickEdit\(place = false\) \{[^]*?defersToNetworkTick\(place\)\) \{\s*if \(!place\) animation\.swing\(\);/);
  assert.match(main, /key\.attack"\) \{ mineHeld = true; clickEdit\(false\)/);
  assert.match(main, /mobs\.afterEntities = \(\) => \{ tiles\(\); tickServerDig\(\); runPendingEdits\(\); \}/);
  assert.match(main, /mobs\.afterEntities = \(\) => redstoneRuntime\?\.tickTiles\(\);/);
});

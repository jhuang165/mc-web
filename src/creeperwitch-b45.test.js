import test from "node:test";
import assert from "node:assert/strict";
import { replayEndermanWolf, referenceCW as reference, firstDivergence } from "./enderman-wolf-replay.js";

// enderman-wolf-b45cw-reference.json: the EndermanWolfProbe with the b45cw- scenarios (tools/verify-endermanwolf.mjs, EW_SET=b45cw), run on the unchanged
// obfuscated classes: creepers (swell, fuse 30, flint and steel, charged by lightning, power 3 and 6, mobGriefing off, difficulty, damage and knockback to
// the player and mobs, blocks and drops, a skeleton arrow kill) and witches (potion choice, throws on the potion's own random, self-drinking and its
// timers, speed modifier, drops). Every tick is compared with every Entity.rand draw, the explosions, spawned items, orbs and potions, and changed cells.
// Not compared: a spawned item's, orb's or potion's own motion in flight (the probe never ticks entities it spawns mid-run), and the player's motion
// outside an explosion (the original pushes the server-side player from a mob's collision; the port never moves the player from a mob's update).
test("creeper and witch reference covers both mobs and explosions", () => {
  assert.ok(reference.records.length >= 77);
  assert.ok(reference.records.some((r) => r.name.includes("creeper")) && reference.records.some((r) => r.name.includes("witch")));
  assert.ok(reference.records.some((r) => r.rows.some((w) => w[5][0].length)));
});
for (const r of reference.records) {
  test(`creeper and witch b45: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

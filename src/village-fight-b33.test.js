import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference33 as reference, firstDivergence } from "./village-fight-replay.js";

// village-fight-b33-reference.json: VillageFightProbe on the unchanged 1.7.10 classes (tools/verify-village-fight.mjs), batch 33 arenas: stairs (ascending,
// upside-down, descending), ladders, trapdoors, fence gates, lava, ice, packed ice, soul sand and cobweb. Same row layout as b32.
for (const r of reference.records) {
  test(`village fight b33: ${r.name} replays with no divergence`, () => {
    const got = replayFight(r);
    assert.equal(firstDivergence(r, got), null, r.name);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
  });
}

// Lit-world Hard reinforcements: EntityZombie.attackEntityFrom summons only where World.getBlockLightValue < 10 (light 9 spawns, 10 and 15 do not).
test("village fight b33: reinforcements need a dark spot (light 9 spawns, 10 and 15 do not)", () => {
  const spawned = (name) => replayFight(reference.records.find((x) => x.name === name)).made.filter((m) => m[1] === "reinforce").length;
  assert.equal(spawned("b33-reinforce-light15-d3"), 0);
  assert.equal(spawned("b33-reinforce-light10-d3"), 0);
  const dark = reference.records.find((x) => x.name === "b33-reinforce-light9-d3");
  assert.ok(dark.zombies.length >= 2);
  assert.equal(spawned("b33-reinforce-light9-d3"), dark.zombies.length);
});

test("village fight b33: the terrain arenas are all present", () => {
  const names = reference.records.map((r) => r.name).join(" ");
  for (const k of ["stairs-up", "stairs-inverted", "ladder", "trapdoor-open", "trapdoor-closed", "gate", "lava", "ice", "packed-ice", "soul-sand", "cobweb"]) assert.ok(names.includes(k), k);
});

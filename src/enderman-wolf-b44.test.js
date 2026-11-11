import test from "node:test";
import assert from "node:assert/strict";
import { replayEndermanWolf, reference44 as reference, firstDivergence } from "./enderman-wolf-replay.js";

// enderman-wolf-b44-reference.json: the batch 42 EndermanWolfProbe with the b44pd- scenarios (tools/verify-endermanwolf.mjs, EW_SET=b44): cows, mooshrooms, pigs, horses, ocelots, iron and snow golems, witches
// and creepers with every EntityAI* task on Entity.rand: idle wander/watch/look draws, panic, tempt, mating (hearts and the experience orb's draws), follow parent, avoid entity, ocelot sit, plus wolf
// taming (bone nextInt(3)), meat healing and mating. Every tick is compared, with every Entity.rand draw.
for (const r of reference.records) {
  test(`passive draws b44: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

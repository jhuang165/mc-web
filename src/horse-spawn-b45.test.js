import test from "node:test";
import assert from "node:assert/strict";
import { replayEndermanWolf, reference45 as reference, firstDivergence } from "./enderman-wolf-replay.js";

// enderman-wolf-b45-reference.json: tools/probes/EndermanWolfProbe.java run with EW_SET=b45 (tools/verify-endermanwolf.mjs): the unchanged EntityHorse driven through the real EntityPlayer.interactWith
// and EntityAIMate: onSpawnWithEgg rolls (alone and as a herd), feeding every food to tame, wild and foal horses, love from golden food, breeding horse x horse, horse x donkey (mule) and donkey x donkey
// with the child's variant and averaged attributes, and the cases that must not breed. Every tick, every Entity.rand draw, the spawn-time draws and the born foals are compared.
for (const r of reference.records) {
  test(`horses b45: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import { replayEndermanWolf, reference47 as reference, firstDivergence } from "./enderman-wolf-replay.js";

// enderman-wolf-b47h-reference.json: tools/probes/EndermanWolfProbe.java run with EW_SET=b47h (tools/verify-endermanwolf.mjs): the unchanged EntityHorse with a real EntityPlayerMP riding it
// (EntityAIRunAroundLikeCrazy: the 1 in 50 buck, temper, the tame roll, the angry rear and the dismount), a rider that tames, mounting again, the gait sounds, the eat and angry sound draws,
// skeleton and zombie horses (type 3 and 4, wild and tame), long idle runs, and a foal that grows up beside a wall (Entity.setSize's moveEntity nudge with collisions).
// Every tick, every Entity.rand draw, position, velocity, rotation and sound is compared.
test("horses b47: the reference has every group", () => {
  const names = reference.records.map((r) => r.name);
  for (const part of ["ride-wild", "ride-temper", "ride-again", "ride-use", "sound-R", "sound-Q", "sound-D", "undead-ride", "foal-wall", "foal-corner"])
    assert.ok(names.some((n) => n.includes(part)), part);
});
for (const r of reference.records) {
  test(`horses b47: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

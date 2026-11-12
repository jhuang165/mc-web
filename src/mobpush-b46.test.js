import test from "node:test";
import assert from "node:assert/strict";
import { replayEndermanWolf, reference46 as reference, firstDivergence } from "./enderman-wolf-replay.js";

// enderman-wolf-b46mp-reference.json: the EndermanWolfProbe with the b46mp- scenarios (tools/verify-endermanwolf.mjs, EW_SET=b46mp) on the unchanged obfuscated classes.
// The probe also runs EntityPlayerMP.onUpdateEntity (mw.i) on its real player after the mobs each tick and puts the server copy back at the client's place afterwards
// (a position packet), so the player's motion is what mobs, hits and its own friction left it. Every tick is compared with every Entity.rand draw and the player's motion (x, z).
test("mob push reference covers cows, pigs, a zombie and witches", () => {
  assert.ok(reference.records.length >= 10);
  assert.ok(reference.records.some((r) => r.name.includes("witch")) && reference.records.some((r) => r.name.includes("cow")));
  assert.ok(reference.records.some((r) => r.rows.some((w) => w[5][3][0] !== 0 || w[5][3][2] !== 0)), "the player is pushed somewhere");
});
for (const r of reference.records) {
  test(`mob push b46: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import { replayEndermanWolf, reference43 as reference, firstDivergence } from "./enderman-wolf-replay.js";

// enderman-wolf-b43-reference.json: the batch 42 EndermanWolfProbe with the b43wd- scenarios: long idle enderman wanders (EntityCreature.updateEntityActionState draws), blocks picked and set down,
// idle, begging (bone, meat) and following wolves. Every tick of every record is compared, with every Entity.rand draw (nextDouble included).
for (const r of reference.records) {
  test(`enderman/wolf b43: ${r.name} replays with no divergence`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null, r.name);
  });
}

test("enderman/wolf b43: the records include picked and placed blocks, begging and following", () => {
  const carried = [];
  for (const r of reference.records.filter((q) => q.name.includes("enderman-carry"))) {
    let last = 0, picks = 0, places = 0;
    for (const row of r.rows) {
      const c = row[0][0][6][4];
      if (c !== last) { if (c) picks++; else places++; last = c; }
    }
    carried.push([picks, places]);
  }
  assert.ok(carried.reduce((a, [p]) => a + p, 0) >= 4 && carried.reduce((a, [, p]) => a + p, 0) >= 3, JSON.stringify(carried));
  assert.ok(reference.records.some((r) => r.name.includes("beg") && r.rows.some((row) => row[0][0][7].includes("i40"))));
  assert.ok(reference.records.some((r) => r.name.includes("follow") && r.rows.some((row) => row[0][0][8][0] !== 0)));
});

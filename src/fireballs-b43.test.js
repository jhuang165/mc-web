import test from "node:test";
import assert from "node:assert/strict";
import { fireballReference43, replayFireballs, fireballDivergence } from "./fireballs-replay.js";

// public/research/fireballs-b43-reference.json (tools/probes/FireballProbe.java, FB_PREFIX=fb43-): the unchanged classes, with the draws of each entity's own Random
// logged per tick. Idle spiders, pigmen, blazes and silverfish, the silverfish deaths of batch 42's avoided seeds, and an iron golem beside a blaze.
for (const r of fireballReference43) {
  test(`native b43 fireballs ${r.name}`, () => {
    assert.equal(fireballDivergence(r, replayFireballs(r)), null);
  });
}

const by = (s) => fireballReference43.filter((r) => r.name.includes(s));

test("the b43 records cover idle wanderers, silverfish deaths and the golem beside a blaze", () => {
  assert.equal(fireballReference43.length, 27);
  assert.ok(fireballReference43.every((r) => r.draws === true));
  assert.equal(by("idle-").length, 13);
  assert.equal(by("ghast-mobs-small").length, 4);
  assert.equal(by("golem-blaze").length, 10);
  // a silverfish that hides or despawns keeps its health and is isDead natively
  const gone = by("idle-k-").filter((r) => r.rows.some((x) => x[0][0][8] === 1));
  assert.ok(gone.length >= 1);
  for (const r of gone) assert.ok(r.rows.some((x) => x[0][0][8] === 1 && x[0][0][6] > 0));
  // golem (0) and blaze (1) hurt each other in most layouts (the golem under 100 or the blaze under 20 by the end; 4486 is the no-contact control), and a blaze that dies keeps updating as a corpse
  const hurt = by("golem-blaze").filter((r) => { const last = r.rows[r.ticks - 1][0]; return last[0][6] < 100 || last[1][6] < 20; });
  assert.equal(hurt.length, 9);
  assert.ok(by("golem-blaze").some((r) => r.rows.some((x) => x[0][1][6] <= 0)));
});

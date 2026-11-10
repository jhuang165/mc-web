import test from "node:test";
import assert from "node:assert/strict";
import { fireballReference, replayFireballs, fireballDivergence } from "./fireballs-replay.js";

// public/research/fireballs-reference.json: the unchanged EntityLargeFireball, EntitySmallFireball and EntityFireball.onUpdate (tools/probes/FireballProbe.java),
// replayed tick by tick against Fireballs.tick.
for (const r of fireballReference.filter((x) => x.case === "fireballs")) {
  test(`native fireballs ${r.name}`, () => {
    const got = replayFireballs(r);
    assert.equal(fireballDivergence(r, got), null);
  });
}

test("the native records cover the flight, impact, deflection and fire rules", () => {
  const all = fireballReference, has = (f) => all.some(f);
  assert.ok(all.length >= 25);
  assert.ok(has((r) => r.rows.some((x) => x[2].some((b) => b[5] === 0)))); // an explosion with mobGriefing off (isSmoking false)
  assert.ok(has((r) => r.rows.some((x) => x[2].some((b) => b[3] === 3)))); // power 3
  assert.ok(has((r) => r.rows.some((x) => x[3].length))); // a small ball's fire
  assert.ok(has((r) => r.rows.some((x) => x[4].some((p) => p[1] === true)))); // a deflecting punch
  assert.ok(has((r) => r.rows.some((x) => x[4].some((p) => p[1] === false)))); // the small ball refuses it
  assert.ok(has((r) => r.rows.some((x) => x[0].some((e) => e[7] > 0)))); // a mob set on fire
  assert.ok(has((r) => r.water));
});

import test from "node:test";
import assert from "node:assert/strict";
import { fireballReference41, replayFireballs, fireballDivergence } from "./fireballs-replay.js";

// public/research/fireballs-b41-reference.json (tools/probes/FireballProbe.java, FB_PREFIX=fb41-): the unchanged 1.7.10 EntityFireball.onUpdate with the inGround
// fields set by the probe (no 1.7.10 path sets them), and blaze volleys at a mob that hurt the blaze (the mobs tick, each ball ticks in its launch pass).
for (const r of fireballReference41) {
  test(`native b41 fireballs ${r.name}`, () => {
    assert.equal(fireballDivergence(r, replayFireballs(r)), null);
  });
}

test("the b41 records cover the stuck, released and swapped ball and the volleys", () => {
  const by = (s) => fireballReference41.filter((r) => r.name.includes(s));
  assert.equal(fireballReference41.length, 10);
  for (const r of by("ground-stays")) { // ticksAlive counts 1 per tick, the ball dies on the 600th and nothing else happens
    assert.equal(r.rows[600][1][0][13], 599);
    assert.equal(r.rows[601][1][0][11], 1);
    assert.equal(r.rows[601][1][0][13], 600);
    assert.ok(r.rows.every((x) => x[2].length === 0));
  }
  for (const r of [...by("released"), ...by("swapped")]) { // the let-go update resets both counters, the motion was scaled by three floats first
    assert.ok(r.rows.some((x) => x[1][0]?.[12] === 0 && x[1][0]?.[13] === 0 && x[1][0]?.[11] === 0));
  }
  for (const r of by("volley")) {
    const far = r.name.includes("far");
    assert.equal(r.shots.length, far ? 0 : 6); // two volleys of three small balls; a blaze out of range never shoots
    if (!far) assert.ok(r.shots.every((s) => s[1] === 0 && s[2] === 0));
  }
  assert.ok(by("volley").some((r) => r.rows.some((x) => x[0][1][6] < 20))); // a fireball hurt the mob target
});

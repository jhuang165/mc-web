import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference35 as reference, firstDivergence } from "./village-fight-replay.js";
import { setPathSearchObserver, setPathNodeCap } from "./pathfinding.js";

// village-fight-b35-reference.json: VillageFightProbe on the unchanged 1.7.10 classes (tools/verify-village-fight.mjs). Besides the b34 row layout, each record lists `searches`:
// [tick, PathPoints the native PathFinder created, 1 if it returned a path] for every search. The port must find the same paths and create the same number of points.
for (const r of reference.records) {
  test(`village fight b35: ${r.name} replays with no divergence and the same search sizes`, () => {
    const sizes = [];
    const was = setPathSearchObserver((s) => sizes.push([s.points, s.found ? 1 : 0]));
    let got;
    try { got = replayFight(r); } finally { setPathSearchObserver(was); }
    assert.equal(firstDivergence(r, got), null, r.name);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
    assert.deepEqual(sizes, r.searches.map((s) => [s[1], s[2]]), `${r.name} search sizes`);
  });
}

test("village fight b35: native searches exceed the live 30000 point cap in range 100 and tower terrain", () => {
  const most = (n) => Math.max(...reference.records.find((r) => r.name === n).searches.map((s) => s[1]));
  assert.ok(most("b35-follow100-sealed-d3") > 30000);
  assert.ok(most("b35-tower-sealed-d3") > 30000);
  assert.ok(most("b35-storeys-sealed-d3") > 20000);
});

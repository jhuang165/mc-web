import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference39 as reference, firstDivergence } from "./village-fight-replay.js";
import { setPathSearchObserver } from "./pathfinding.js";

// village-fight-b39-reference.json: VillageFightProbe on the unchanged 1.7.10 spider (yn), cave spider (xy) and zombie pigman (yh).
for (const r of reference.records) {
  test(`village fight b39: ${r.name} replays with no divergence and the same search sizes`, () => {
    const sizes = [];
    const was = setPathSearchObserver((s) => sizes.push([s.points, s.found ? 1 : 0]));
    let got;
    try { got = replayFight(r); } finally { setPathSearchObserver(was); }
    assert.equal(firstDivergence(r, got), null, r.name);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
    assert.deepEqual(sizes, r.searches.map((s) => [s[1], s[2]]), `${r.name} search sizes`);
  });
}

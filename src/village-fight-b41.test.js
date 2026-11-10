import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference41 as reference, firstDivergence } from "./village-fight-replay.js";
import { setPathSearchObserver } from "./pathfinding.js";

// village-fight-b41-reference.json: VillageFightProbe with a real EntityPlayerMP (ServerPlayerProbe): creative, adventure, invisible, sneaking and range target rules of zombie, skeleton, spider and cave spider.
for (const r of reference.records) {
  test(`village fight b41: ${r.name} replays with no divergence and the same search sizes`, () => {
    const sizes = [];
    const was = setPathSearchObserver((s) => sizes.push([s.points, s.found ? 1 : 0]));
    let got;
    try { got = replayFight(r); } finally { setPathSearchObserver(was); }
    assert.equal(firstDivergence(r, got), null, r.name);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
    assert.deepEqual(sizes, r.searches.map((s) => [s[1], s[2]]), `${r.name} search sizes`);
  });
}

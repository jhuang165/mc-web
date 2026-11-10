import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference37 as reference, firstDivergence } from "./village-fight-replay.js";
import { setPathSearchObserver } from "./pathfinding.js";

// village-fight-b37-reference.json: VillageFightProbe on the unchanged 1.7.10 classes (tools/verify-village-fight.mjs). Same layout as b36 plus the chicken wander records on the probe's stone floor,
// and spiders with their skeleton jockeys (`spawnspider` and `hitmob` ops, `mobs`, rows[t][7], `local`).
for (const r of reference.records) {
  test(`village fight b37: ${r.name} replays with no divergence and the same search sizes`, () => {
    const sizes = [];
    const was = setPathSearchObserver((s) => sizes.push([s.points, s.found ? 1 : 0]));
    let got;
    try { got = replayFight(r); } finally { setPathSearchObserver(was); }
    assert.equal(firstDivergence(r, got), null, r.name);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
    assert.deepEqual(sizes, r.searches.map((s) => [s[1], s[2]]), `${r.name} search sizes`);
    if (r.spawns?.length) assert.deepEqual(got.spawnLog.map((s) => s.slice(0, 6)), r.spawns.map((s) => s.slice(0, 6)), `${r.name} spawns`);
  });
}

const rec = (name) => reference.records.find((x) => x.name === name);
const diverges = (name, change) => {
  const r = { ...rec(name), ...change };
  try { return firstDivergence(r, replayFight(r)) !== null; } catch { return true; } // a record that no longer has its mobs cannot replay at all
};

// RandomPositionGenerator.findRandomTarget keeps the first of ten tries with the greatest getBlockPathWeight. Below y 0 the probe world is stone, so every try weighs brightness - 0.5 and the first one wins,
// even when its dy is negative; the partial path then goes to the reachable cell nearest it. The seed 1406 chicken that looked underground in the first b37 replay was a replay floor that was grass (weight 10).
test("village fight b37: the underground wander targets follow the first try on a stone floor, the grass patch changes them", () => {
  const last = (name, i) => rec(name).rows.at(-1)[0][i].slice(0, 3).map((v) => Math.round(v * 100) / 100);
  assert.deepEqual(last("b37-chicken-wander-1406", 6), [68.53, 0, 59.49]);
  assert.deepEqual(last("b37-chicken-wander-1406", 5), [84.49, 0, 66.49]);
  // the record's winning try is underground over stone: grass in the cells below y 0 (weight 10 for tries over it) replays another wander
  assert.ok(diverges("b37-chicken-wander-1406", { blocks: [[0, -3, 0, 120, -1, 120, 2, 0]] }));
  // the patch of grass under the pen changes seed 1402's wander (tries over grass weigh 10) and leaves seed 1413's alone
  assert.notDeepEqual(last("b37-chicken-wander-1402", 5), last("b37-chicken-wander-grass-1402", 5));
  assert.deepEqual(last("b37-chicken-wander-1413", 5), last("b37-chicken-wander-grass-1413", 5));
  assert.ok(diverges("b37-chicken-wander-grass-1402", { blocks: [] }));
  // other seeds find other targets
  for (const name of ["b37-chicken-wander-1401", "b37-chicken-wander-1402", "b37-chicken-wander-1413"]) assert.ok(diverges(name, { seed: rec(name).seed + 1 }), name);
});

// The zombie on the nearby chicken (seed 113, Hard): the rider runs its whole update, including its own move from the seat it was left at, and the seat then takes it; an earlier port skipped the rider's move.
test("village fight b37: the zombie jockey's own move and push happen before the seat takes it (seed 113)", () => {
  const r = rec("b37-jockey-nearby-113-d3");
  assert.equal(firstDivergence(r, replayFight(r)), null);
  assert.equal(r.spawns[0][3], 1, "a nearby chicken was mounted");
});

// EntitySpider.onSpawnWithEgg: World.rand rolls the 1-in-100 jockey, then on Hard nextFloat < 0.1 * local picks the effect from [1, 1, 5, 10, 14]; the skeleton's own onSpawnWithEgg runs when it is built, then mountEntity.
test("village fight b37: spider jockey spawns and the Hard potion effect match the native rolls", () => {
  const spiders = reference.records.filter((r) => r.mobs?.length);
  assert.equal(spiders.length, 7);
  const jockeys = spiders.filter((r) => r.mobs.length === 2);
  assert.equal(jockeys.length, 6);
  for (const r of jockeys) assert.deepEqual([r.mobs[1][1], r.mobs[1][7]], [1, 0], "a skeleton riding the spider");
  const effect = (name) => replayFight(rec(name)).extraMobs[0].effects?.map((e) => e.id) ?? [];
  assert.deepEqual(effect("b37-spider-jockey-d2-47"), [], "no potion below Hard");
  assert.deepEqual(effect("b37-spider-jockey-speed-2231"), [1]);
  assert.deepEqual(effect("b37-spider-jockey-regen-1713"), [10]);
  assert.deepEqual(effect("b37-spider-jockey-invisible-972"), [14]);
  assert.deepEqual(effect("b37-spider-jockey-strength-1003"), [5]);
  assert.deepEqual(effect("b37-spider-effect-nojockey-4"), [5]);
  // the Speed potion is a native attribute change at spawn: 0.8 * 1.2
  assert.ok(Math.abs(rec("b37-spider-jockey-speed-2231").mobs[0][8] - 0.96) < 1e-6);
  // another World.rand seed rolls other things
  for (const r of spiders) assert.ok(diverges(r.name, { seed: r.seed + 1 }), r.name);
  // without the Hard potion roll's regional difficulty nothing is drawn after the jockey roll: the same seed replays differently
  assert.ok(diverges("b37-spider-jockey-speed-2231", { local: 0 }));
});

// The golem kills the spider at the end of b37-spider-jockey-golem-1713 while the skeleton rides it; the player's two hits on the skeleton land, the rider's own AI keeps drawing on its Entity.rand,
// and mount and rider stay at the same place (the seat) every tick.
test("village fight b37: a skeleton jockey is hit, rides and falls with its spider in the native update order", () => {
  const r = rec("b37-spider-jockey-golem-1713");
  assert.deepEqual(r.hits.map((h) => [h[0], h[1]]), [[30, true], [50, true]]);
  const got = replayFight(r);
  assert.equal(firstDivergence(r, got), null);
  for (const row of r.rows.slice(4)) { const [spider, skeleton] = row[7]; assert.equal(spider[0], skeleton[0]); assert.equal(spider[2], skeleton[2]); }
  assert.equal(r.rows.at(-1)[7][0][3], 0, "the spider died");
  assert.ok(got.extraMobs[1].ridingEntity === got.extraMobs[0] || got.extraMobs[1].health > 0);
  // the hits matter: without the first one the draws differ
  assert.ok(diverges("b37-spider-jockey-golem-1713", { script: r.script.filter((s) => !s.startsWith("30 hitmob")) }));
});

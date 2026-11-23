// Batch 98 mobrec98: executed villager records on the unchanged 1.7.10 classes.
//  - tools/probes/VillageFightProbe.java (b98- records, villager row element 8) -> tools/verify-villagers98.mjs ->
//    public/research/village-fight-b98{,-trade,-breed1,-breed2,-breed3}-reference.json: 32 records (AI tasks, doors, fleeing, breeding, a child at play, trading and restock).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fightReference98, replayFight, firstDivergence } from "./village-fight-replay.js";

const recs = fightReference98.records;
const find = (n) => recs.find((r) => r.name === n);
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

test("mobrec98: the b98 references hold 32 executed villager records", () => {
  assert.equal(recs.length, 32);
  assert.equal(recs.filter((r) => r.name.startsWith("b98-trade")).length, 9);
  assert.equal(recs.filter((r) => r.name.startsWith("b98-breed")).length, 9);
});
for (const r of recs) {
  test(`mobrec98: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayFight(r))), "null", r.name);
  });
}
test("mobrec98 look: the trading look timer draws 40 + nextInt(40) and its customer record holds through the run (Executed b98-trade-look-9830/9831, Bytecode-read un/uo)", () => {
  for (const n of ["b98-trade-look-9830", "b98-trade-look-9831"]) {
    const r = find(n), got = replayFight(r);
    assert.equal(firstDivergence(r, got), null);
    const c = r.rows.map((x) => x[8][0][3]);
    assert.equal(c.indexOf(1), 5);
    assert.equal(c.lastIndexOf(1), 99);
  }
  const s = src("./villager.js");
  assert.match(s, /this\.timer = 40 \+ this\.m\.rand\.nextInt\(40\)/);
});
test("mobrec98 restock: a trade sets riches, the 40-tick reset timer and needsInit (Executed b98-trade-restock-9833)", () => {
  const r = find("b98-trade-restock-9833"), got = replayFight(r);
  assert.deepEqual(r.rows[12][8][0].slice(4, 11), [40, 1, 1, 1, [1], [7], 0]);
  assert.deepEqual(got.states[12].villagers[0].slice(4, 11), [40, 1, 1, 1, [1], [7], 0]);
  assert.deepEqual(r.rows.map((x) => x[2]).filter((v, i, a) => JSON.stringify(v) !== JSON.stringify(a[i - 1])), [0, 1]); // "probe" reputation +1
  assert.deepEqual(got.rows.map((x) => x[2]).filter((v, i, a) => JSON.stringify(v) !== JSON.stringify(a[i - 1])), [0, 1]);
});
test("mobrec98 birth: the child is born at growing age -24000 with the onSpawnWithEgg follow-range draw (Executed b98-breed-birth-9902, b98-breed-three-9819)", () => {
  const r = find("b98-breed-birth-9902"), got = replayFight(r);
  assert.equal(firstDivergence(r, got), null);
  const n = r.rows.findIndex((x) => x[8].length === 3);
  assert.equal(n, 635);
  assert.deepEqual(r.rows[n][8].map((v) => v[0]), [5999, 5999, -23999]);
  assert.deepEqual(got.states[n].villagers.map((v) => v[0]), [5999, 5999, -23999]);
  assert.match(src("./entities.js"), /this\.addSpawnBonus\(baby, spawnBonus\(entityRandom\(baby\)\)\[0\]\)/);
});

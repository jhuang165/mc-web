// Batch 99 mobrec99: villager births replayed against executed 1.7.10 records (VillageFightProbe b99- records, tools/verify-villagers99.mjs ->
// public/research/village-fight-b99-birth{1..4}-reference.json). Villager rows end with [rotationYaw, renderYawOffset, rotationYawHead, rotationPitch].
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fightReference99, replayFight, firstDivergence } from "./village-fight-replay.js";

const recs = fightReference99.records;
const find = (n) => recs.find((r) => r.name === n);
const births = (r) => r.rows.findIndex((x) => x[8].length > r.rows[0][8].length);

test("mobrec99: the b99 references hold 8 executed villager records, 7 with a birth", () => {
  assert.equal(recs.length, 8);
  assert.equal(recs.filter((r) => births(r) >= 0).length, 7);
  assert.equal(births(find("b99-birth-d5v2-10130")), -1); // 5 doors: too few for a third villager
});
for (const r of recs) {
  test(`mobrec99: ${r.name} replays with no divergence (positions, draws, villager state and yaws)`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayFight(r))), "null", r.name);
  });
}
test("mobrec99 birth: the child starts at age -24000 with yaw 0 and parents at 6000 (Executed b99-birth-d9v2-10072)", () => {
  const r = find("b99-birth-d9v2-10072"), t = births(r);
  assert.equal(t, 704);
  assert.deepEqual(r.rows[t][8][2].slice(0, 1), [-23999]);
  assert.deepEqual(r.rows[t][8][2][12], [0, 0, 0, 0]);
  assert.deepEqual(r.rows[t][8].slice(0, 2).map((v) => v[0]), [5999, 5999]);
  assert.deepEqual(replayFight(r).states[t].villagers[2].slice(12)[0], [0, 0, 0, 0]);
});
test("mobrec99 look: an equal-distance tie goes to the later entity, a child standing on its parent (Executed b99-birth-d12v2-10424 tick 933, Bytecode-read ahb.a dcmpl/ifle)", () => {
  const r = find("b99-birth-d12v2-10424"), got = replayFight(r);
  assert.ok(r.rows[933][8][0][12][3] > 30); // the adult next to the pair looks down at the child, not at its parent
  assert.equal(got.states[933].villagers[0][12][3], r.rows[933][8][0][12][3]);
  assert.match(readFileSync(new URL("./ai.js", import.meta.url), "utf8"), /if \(d <= bd\) \{ best = b; bd = d; \} \/\/ World\.findNearestEntityWithinAABB/);
});

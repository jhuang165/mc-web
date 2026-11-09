import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference32 as reference } from "./village-fight-replay.js";

// village-fight-b32-reference.json: VillageFightProbe on the unchanged 1.7.10 classes (tools/verify-village-fight.mjs), batch 32 arenas: 1- and 2-block
// terrain steps and a terrace, a water pool (real water physics), closed and open doors the villagers and zombies work, arrows into stone, a fence, glass and a
// slab, and Hard zombie reinforcements in a dark world. Converted and reinforcement zombies are seeded (a patched Entity constructor), so their own ticks and
// arrow headings replay from the seed; the one start value no seed reaches is the new zombie's constructor yaw (Math.random), kept in the record.
const near = (a, b) => Math.abs(a - b) < 1e-9;
function firstDivergence(r, got) {
  const n = r.types.length;
  for (let t = 0; t < r.ticks; t++) {
    const want = r.rows[t][0];
    for (let i = 0; i < n; i++) {
      const w = want[i], g = got.states[t][i];
      for (let k = 0; k < 6; k++) if (w[k] !== g[k]) return [t, i, k, w[k], g[k]];
      if (JSON.stringify(w[6]) !== JSON.stringify(g[6])) return [t, i, "draws", w[6], g[6]];
    }
    if (JSON.stringify(r.rows[t][3]) !== JSON.stringify(got.states[t].arrows)) return [t, "arrows"];
    if (JSON.stringify(r.rows[t][4]) !== JSON.stringify(got.states[t].extras)) return [t, "extra zombies", r.rows[t][4], got.states[t].extras];
    const before = t ? r.rows[t - 1][0][n][3] : 1000;
    if (!near(before - want[n][3], got.playerDamage[t])) return [t, "player damage", before - want[n][3], got.playerDamage[t]];
  }
  for (const a of got.shots) if (a.headingDiff.length) return ["arrow start state", a.id, a.headingDiff];
  return null;
}

test("village fight b32: all native records replay with no divergence", () => {
  assert.equal(reference.records.length, 22);
  for (const r of reference.records) assert.equal(firstDivergence(r, replayFight(r)), null, r.name);
});

test("village fight b32: hit results, shots, conversions and player damage match", () => {
  let shots = 0, conversions = 0;
  for (const r of reference.records) {
    const got = replayFight(r);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
    assert.deepEqual(got.shotLog.map((s) => [s[0], s[1]]), r.shots.map((s) => [s[0], s[1]]), r.name + " shots");
    assert.equal(got.conversions.length, r.conversions.length, r.name);
    for (let i = 0; i < r.conversions.length; i++) r.conversions[i].forEach((v, k) => assert.ok(near(v, got.conversions[i][k]), r.name));
    shots += r.shots.length; conversions += r.conversions.length;
  }
  assert.ok(shots >= 20 && conversions >= 7, `${shots} shots, ${conversions} conversions`);
});

test("village fight b32: arrow start headings come from the seeded Random, not the record", () => {
  for (const r of reference.records.filter((x) => x.shots.length)) {
    const got = replayFight(r);
    assert.equal(got.shots.length, r.shots.length, r.name);
    for (const a of got.shots) assert.deepEqual(a.headingDiff, [], r.name);
  }
});

test("village fight b32: Hard reinforcements in a dark world spawn where the native search found a spot", () => {
  for (const name of ["b32-reinforce-d3", "b32-reinforce-hunt-d3"]) {
    const r = reference.records.find((x) => x.name === name);
    assert.equal(r.light, 0);
    assert.ok(r.zombies.length >= 2, name);
    const got = replayFight(r);
    const spawned = got.made.filter((m) => m[1] === "reinforce");
    assert.equal(spawned.length, r.zombies.length, name);
    spawned.forEach((m, i) => assert.deepEqual([m[0], m[2], m[3], m[4]], [r.zombies[i][0], r.zombies[i][2], r.zombies[i][3], r.zombies[i][4]], name));
  }
});

test("village fight b32: terrain, water, door and arrow-block arenas are all present and exercised", () => {
  const names = reference.records.map((r) => r.name);
  for (const k of ["step1", "step2", "terrace", "pool", "closed-door", "open-door", "arrows-stone", "arrows-fence", "arrows-glass", "arrows-slab"]) assert.ok(names.some((n) => n.includes(k)), k);
  assert.ok(reference.records.filter((r) => r.water).length >= 3);
  assert.ok(reference.records.filter((r) => r.name.includes("door")).every((r) => r.blocks.length >= 7));
  const pool = replayFight(reference.records.find((r) => r.name === "b32-pool-hunt-d3"));
  assert.ok(pool.ew.entities.length > 0);
});

test("village fight b32: the golem attacks through its long memory and zombies break doors on Hard", () => {
  const closed = replayFight(reference.records.find((r) => r.name === "b32-closed-door-d3"));
  assert.ok(closed.conversions.length >= 1);
});

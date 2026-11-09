import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference31 as reference } from "./village-fight-replay.js";

// village-fight-b31-reference.json: VillageFightProbe on the unchanged 1.7.10 classes (tools/verify-village-fight.mjs), batch 31 scenarios: three or more
// zombies, a Hard zombie that breaks doors and calls reinforcements, hunts that end with a zombie killing a villager (Normal 50 %, Hard always: the villager
// is replaced), bow skeletons whose arrows fly, hit mobs, villagers and the player, a moving player hitting back, equipment swaps (a bow given and taken
// away, once between two mob updates), and hits on mobs the world already removed. Every record must replay exactly: positions, health, targets, Entity.rand
// draws per mob per tick, the arrows (position and motion each tick they change), damage dealt to the player, hit results and conversions.
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
    const before = t ? r.rows[t - 1][0][n][3] : 1000;
    if (!near(before - want[n][3], got.playerDamage[t])) return [t, "player damage", before - want[n][3], got.playerDamage[t]];
  }
  return null;
}

test("village fight b31: all native records replay with no divergence", () => {
  assert.equal(reference.records.length, 19);
  for (const r of reference.records) assert.equal(firstDivergence(r, replayFight(r)), null, r.name);
});

test("village fight b31: hit results, shots, conversions and player damage match", () => {
  let shots = 0, conversions = 0, damaged = 0;
  for (const r of reference.records) {
    const got = replayFight(r);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1]]), r.hits.map((h) => [h[0], h[1]]), r.name);
    assert.deepEqual(got.hits.map((h) => h[2]), r.hits.map((h) => h[2]), r.name);
    assert.deepEqual(got.shotLog.map((s) => s[0]), r.shots.map((s) => s[0]), r.name + " shot ticks");
    assert.deepEqual(got.shotLog.map((s) => s[1]), r.shots.map((s) => s[1]), r.name + " shooters");
    assert.equal(got.conversions.length, r.conversions.length, r.name);
    for (let i = 0; i < r.conversions.length; i++) r.conversions[i].forEach((v, k) => assert.ok(near(v, got.conversions[i][k]), r.name));
    shots += r.shots.length; conversions += r.conversions.length;
    damaged += got.playerDamage.filter((d) => d > 0).length;
  }
  assert.ok(shots >= 100 && conversions >= 5 && damaged > 0, `${shots} shots, ${conversions} conversions, ${damaged} damaged ticks`);
});

test("village fight b31: Hard villager kills always convert, Normal ones sometimes, arrows hit villagers and other mobs", () => {
  const rec = (n) => reference.records.find((r) => r.name === n);
  for (const s of [0, 1, 2]) assert.equal(rec(`b31-zombies-hunt-d3-${s}`).conversions.length, 1);
  const hunts = [0, 1, 2].map((s) => rec(`b31-zombies-hunt-d2-${s}`).conversions.length);
  assert.ok(hunts.includes(0) && hunts.includes(1), "Normal: a draw on the killer decides");
  const villagers = replayFight(rec("b31-arrows-through-villagers-d2"));
  assert.ok(villagers.states.some((s) => s.arrows.some((a) => a[7] === 1)), "an arrow ends");
});

test("village fight b31: a bow swapped between two mob updates changes the combat task for the next evaluation and reuses the old task objects", () => {
  const r = reference.records.find((x) => x.name === "b31-equip-swap");
  assert.equal(firstDivergence(r, replayFight(r)), null);
});

test("village fight b31: a hit on a removed mob still lands once, the hurt window then refuses the second", () => {
  const r = reference.records.find((x) => x.name === "b31-peaceful-hit-removed");
  const got = replayFight(r);
  assert.deepEqual(got.hits.map((h) => h[1]), [true, false, true]);
  assert.ok(near(got.hits[0][2], 17.239999771118164));
});

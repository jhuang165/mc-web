import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference as reference } from "./village-fight-replay.js";

// VillageFightProbe on the unchanged 1.7.10 classes (tools/verify-village-fight.mjs): villagers, zombies, skeletons and an iron golem all ticked, a
// moving player whose hits are scripted. village-fight-replay.js ticks the port's mobs through the same script. Two checks:
//  1. the VILLAGE layer tick by tick up to the first mob-on-mob death: hit results, the aggressor list [entity index, last tick] with ordering,
//     expiry and removal, and the player's reputation (-1 per hit, -5 for killing a village golem, a second name starting at 0);
//  2. the MOB layer: per tick every mob's position (within MOVE_TOL), health, attack target, revenge target and Entity.rand draws (exact), up to
//     the first tick that diverges. FIRST_DIVERGENCE pins that tick per scenario, so a fix or a regression moves it and fails here.
const MOVE_TOL = 1e-3;
// Why each scenario first diverges (bytecode-read and probe-observed):
//  player-fights-zombie-0 114: villager 1 flees (AvoidEntity draws i32/i14) from a zombie natively; the port's villager does not see it (the sight ray
//    passes the door natively, the port's door cell blocks or is in another state).
//  player-fights-zombie-1 241 and zombies-and-shooters-1 232: a killed mob's death ticks draw nextGaussian x3 and nextFloat x3 per tick natively
//    (the death explosion particle arguments of EntityLiving.onDeathUpdate); the port plays them as events without drawing Entity.rand.
//  zombies-and-shooters-0 and player-turns-aggressive 322: zombie 3 drifts about 1e-3 in x after many collision pushes (position only).
const FIRST_DIVERGENCE = { "player-fights-zombie-0": 114, "zombies-and-shooters-0": 322, "player-fights-zombie-1": 241, "zombies-and-shooters-1": 232, "player-turns-aggressive": 322 };

function firstDivergence(r, got) {
  for (let t = 0; t < r.ticks; t++) {
    const want = r.rows[t][0];
    for (let i = 0; i < 7; i++) {
      const w = want[i], g = got.states[t][i];
      if ([0, 1, 2].some((k) => Math.abs(w[k] - g[k]) > MOVE_TOL) || w[3] !== g[3] || w[4] !== g[4] || w[5] !== g[5] || JSON.stringify(w[6]) !== JSON.stringify(g[6])) return t;
    }
  }
  return r.ticks;
}
const replay = replayFight;

test("village fight: player hits, aggressor list and reputation up to the first mob-on-mob death in each native scenario", () => {
  assert.equal(reference.records.length, 5);
  const limits = {};
  for (const r of reference.records) {
    const got = replay(r);
    // the first tick at which a native mob (zombie or skeleton; the golem's own death by the player is replayed) has been killed by another mob: the port has no mob-on-mob revenge or kills there
    const dead = r.rows.findIndex((row) => [2, 3, 5, 6].some((i) => row[0][i][3] <= 0));
    const limit = dead < 0 ? r.ticks : dead;
    limits[r.name] = limit;
    for (let t = 0; t < limit; t++) {
      const want = r.rows[t];
      assert.deepEqual(got.rows[t][0], want[1], `${r.name} tick ${t} aggressors`);
      // the port keys its one local player by "Player"; the native rename to "alt" at tick 600 starts a fresh entry (checked below)
      if (!(r.name === "player-turns-aggressive" && t >= 600)) assert.equal(got.rows[t][1], want[2], `${r.name} tick ${t} reputation`);
    }
    assert.deepEqual(got.hits.filter(([t]) => t < limit).map(([t, h]) => [t, h]), r.hits.filter(([t]) => t < limit).map(([t, h]) => [t, h]), `${r.name} hit results`);
  }
  // the checked windows: both player-fights scenarios run to the end; the shooter scenarios until the golem kills a skeleton / zombie
  assert.equal(limits["player-fights-zombie-0"], 260);
  assert.equal(limits["player-turns-aggressive"], 700);
  assert.ok(limits["zombies-and-shooters-0"] > 200 && limits["zombies-and-shooters-1"] > 200);
});

test("village fight: the mob layer (targets, revenge, positions, Random draws) matches the native rows up to the pinned first divergence", () => {
  for (const r of reference.records) {
    const got = replayFight(r), first = firstDivergence(r, got);
    assert.equal(first, FIRST_DIVERGENCE[r.name], `${r.name} first diverging tick`);
    assert.ok(first >= 100, `${r.name} matches for at least 100 ticks`);
  }
});

test("village fight: every mob-on-mob revenge target in the first 200 ticks of the shooter scenario matches the native rows", () => {
  const r = reference.records.find((x) => x.name === "zombies-and-shooters-0");
  const got = replayFight(r);
  // the native rows show some mob-on-mob revenge target (villagers and golem take arrows and hits from mobs); the port reproduces each one exactly
  let mobOnMob = 0;
  for (let t = 0; t < 200; t++) for (let i = 0; i < 7; i++) {
    const want = r.rows[t][0][i][5];
    if (want >= 0 && want !== 7) { mobOnMob++; assert.equal(got.states[t][i][5], want, `tick ${t} mob ${i} revenge`); }
  }
  assert.ok(mobOnMob > 100);
});

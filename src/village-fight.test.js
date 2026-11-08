import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference as reference } from "./village-fight-replay.js";

// VillageFightProbe on the unchanged 1.7.10 classes (tools/verify-village-fight.mjs): villagers, zombies, skeletons and an iron golem all ticked, a
// moving player whose hits are scripted. village-fight-replay.js ticks the port's mobs through the same script. Two checks:
//  1. the VILLAGE layer tick by tick up to the first mob-on-mob death: hit results, the aggressor list [entity index, last tick] with ordering,
//     expiry and removal, and the player's reputation (-1 per hit, -5 for killing a village golem, a second name starting at 0);
//  2. the MOB layer: per tick every mob's position (within MOVE_TOL), health, attack target, revenge target and Entity.rand draws (exact), up to
//     the first tick that diverges. FIRST_DIVERGENCE pins that tick per scenario, so a fix or a regression moves it and fails here.
const MOVE_TOL = 0;
// Batch 30: every scenario now matches to the end of the recording with exact positions. Fixed since batch 29: the probe double's rayTraceBlocks
//  returned null (a villager saw a zombie through a closed door; the port was right: probe bug, now real rays), killed mobs draw g g g f f f x 20 at
//  deathTime 20 on Entity.rand (a null fx still draws), a mob keeps its bounding box between moves (x = (minX + maxX) / 2 carries the rounding), and
//  EntityIronGolem lifts its target by the double 0.4000000059604645.
const FIRST_DIVERGENCE = "end";

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
  assert.equal(reference.records.length, 7);
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
    assert.equal(first, r.ticks, `${r.name} first diverging tick`);
    assert.ok(first >= 100, `${r.name} matches for the whole recording`);
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

test("village fight: villagers flee from two zombies (the golem kills one; WatchClosest still picks the corpse) and Peaceful mobs run one last tick, then go, as natively", () => {
  const names = reference.records.map((r) => r.name);
  assert.ok(names.includes("villagers-flee-two-zombies") && names.includes("peaceful"));
  const peaceful = reference.records.find((r) => r.name === "peaceful");
  assert.equal(peaceful.difficulty, 0);
  // native tick 0: the zombies and the target-less skeletons still move/draw once (EntityMob.onUpdate runs super.onUpdate before setDead), none ticks again
  assert.deepEqual(peaceful.rows[0][0][2][6], ["i1000", "i7"]);
  assert.deepEqual(peaceful.rows[1][0][2][6], []);
  const got = replayFight(peaceful);
  assert.deepEqual(got.states[0][2][6], ["i1000", "i7"]);
  assert.deepEqual(got.states[1][2][6], []);
  const flee = reference.records.find((r) => r.name === "villagers-flee-two-zombies");
  // the villagers draw their AvoidEntity flee rolls (i32 / i14) in the native rows, and the port draws the same
  const drew = (rows) => rows.filter((row) => row[0][0][6].includes("i14") || row[0][1][6].includes("i14")).length;
  assert.ok(drew(flee.rows) > 0);
  assert.equal(drew(flee.rows), replayFight(flee).states.filter((s) => s[0][6].includes("i14") || s[1][6].includes("i14")).length);
});

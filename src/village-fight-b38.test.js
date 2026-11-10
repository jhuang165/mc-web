import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference38 as reference, firstDivergence } from "./village-fight-replay.js";
import { setPathSearchObserver } from "./pathfinding.js";

// village-fight-b38-reference.json: VillageFightProbe on the unchanged 1.7.10 spider (yn), cave spider (xy) and zombie pigman (yh), which run EntityCreature.updateEntityActionState
// (legacy-creature.js). Rows: per mob [x, y, z, health, entityToAttack index, revenge index, draws]; `poison` is the player's Poison duration per tick.
for (const r of reference.records) {
  test(`village fight b38: ${r.name} replays with no divergence and the same search sizes`, () => {
    const sizes = [];
    const was = setPathSearchObserver((s) => sizes.push([s.points, s.found ? 1 : 0]));
    let got;
    try { got = replayFight(r); } finally { setPathSearchObserver(was); }
    assert.equal(firstDivergence(r, got), null, r.name);
    assert.deepEqual(got.hits.map((h) => [h[0], h[1], h[2]]), r.hits.map((h) => [h[0], h[1], h[2]]), r.name);
    assert.deepEqual(sizes, r.searches.map((s) => [s[1], s[2]]), `${r.name} search sizes`);
  });
}

const rec = (name) => reference.records.find((x) => x.name === name);
const targets = (name, i = 0) => rec(name).rows.map((row) => row[0][i][4]);
const diverges = (name, change) => {
  const r = { ...rec(name), ...change };
  try { return firstDivergence(r, replayFight(r)) !== null; } catch { return true; }
};

// EntitySpider.findPlayerToAttack (yn.bR): only in light below 0.5 and with no sight test; a hit makes the attacker the target in any light (EntityMob.attackEntityFrom).
test("village fight b38: a spider hunts in the dark, ignores the player by day and is provoked by a hit from any distance", () => {
  assert.ok(targets("b38-spider-hunt-night-3811").every((t) => t === 1), "hunts from tick 0 at night");
  assert.ok(targets("b38-spider-day-ignores-3813").every((t) => t === -1), "ignores a player standing 4 blocks away by day");
  const far = targets("b38-spider-hit-far-night-3815");
  assert.deepEqual([far[19], far[20]], [-1, 1]);
  const day = targets("b38-spider-day-hit-forgets-3814");
  assert.deepEqual([day[9], day[10]], [-1, 1]);
  assert.equal(day.at(-1), -1, "the 1 in 100 forget roll in light above 0.5 ends the hunt");
  assert.ok(rec("b38-spider-hunt-night-3811").rows.some((row) => row[0][0][1] > 0.3), "it leaps (2 to 6 blocks, one tick in ten, from the ground)");
  for (const name of ["b38-spider-hunt-night-3811", "b38-spider-hit-far-night-3815", "b38-spider-day-hit-forgets-3814"]) assert.ok(diverges(name, { seed: rec(name).seed + 1 }), name);
});

test("village fight b38: the golem's hit retargets the spider to the golem", () => {
  const t = targets("b38-spider-golem-hit-night-3821", 2);
  assert.deepEqual([t[19], t[20]], [-1, 3]);
});

// EntityCaveSpider.attackEntityAsMob: Poison 7 s on Normal, 15 s on Hard, none on Easy (the player's poison duration per tick in the record).
test("village fight b38: cave spider poison by difficulty", () => {
  const top = (name) => Math.max(...rec(name).poison);
  assert.deepEqual([top("b38-cave-spider-night-d1"), top("b38-cave-spider-night-d2"), top("b38-cave-spider-night-d3")], [0, 140, 300]);
  assert.equal(top("b38-cave-spider-day-hit-3834"), 140);
});

// EntityPigZombie: a player's hit angers every pigman inside the 32 block box (each target = the player, own Entity.rand), the far one only when hit itself.
test("village fight b38: a pigman hit by the player angers the group within 32 blocks and no other", () => {
  const rows = rec("b38-pigman-anger-group-3842").rows;
  assert.deepEqual(rows[9][0].slice(0, 3).map((m) => m[4]), [-1, -1, -1]);
  assert.deepEqual(rows[10][0].slice(0, 3).map((m) => m[4]), [3, 3, -1]);
  assert.deepEqual(rows[260][0].slice(0, 3).map((m) => m[4]), [3, 3, 3]);
  assert.ok(diverges("b38-pigman-anger-group-3842", { seed: rec("b38-pigman-anger-group-3842").seed + 1 }));
});

// The spider jockey records run 450 ticks with the spider on its legacy AI: its draws are compared whole (the b37 records compared them only up to the first sound roll).
test("village fight b38: spider jockeys replay 450 ticks, and a despawning spider lets its skeleton fall", () => {
  const r = rec("b38-spider-jockey-day-d2-47"), got = replayFight(r);
  assert.equal(r.ticks, 450);
  assert.equal(firstDivergence(r, got), null);
  const i = r.rows.findIndex((row) => row[7].length === 2 && row[7][1][1] - row[7][0][1] < 0.17);
  assert.ok(i > 100 && i < 450, "the skeleton leaves its seat on the tick the spider despawns (i800 roll)");
  assert.ok(r.rows[i][7][0][6].includes("i800"));
});

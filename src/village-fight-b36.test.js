import test from "node:test";
import assert from "node:assert/strict";
import { replayFight, fightReference36 as reference, firstDivergence } from "./village-fight-replay.js";
import { setPathSearchObserver } from "./pathfinding.js";

// village-fight-b36-reference.json: VillageFightProbe on the unchanged 1.7.10 classes (tools/verify-village-fight.mjs). Same row layout as b35 plus the chickens a baby zombie spawns and the jockey flags
// (rows[t][5], rows[t][6]), the `spawn` script op (`spawns`, `chickens`), held-item swaps, gates and doors on slopes, and villagers fleeing across storeys.
for (const r of reference.records) {
  test(`village fight b36: ${r.name} replays with no divergence and the same search sizes`, () => {
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
  return firstDivergence(r, replayFight(r)) !== null;
};

// EntityZombie.onSpawnWithEgg (yq.a): a baby zombie takes a free chicken within 5 x 3 x 5 (kind 1), or 5 % of the time makes a new one (kind 2), which World.spawnEntityInWorld may refuse in an unloaded chunk.
test("village fight b36: the records cover a nearby chicken, a new chicken in a loaded chunk and a new chicken in an unloaded one", () => {
  const kinds = new Map(reference.records.filter((r) => r.spawns?.length).map((r) => [r.name, r.spawns[0]]));
  const [, spawned, child, kind, near, chickenSpawned] = kinds.get("b36-jockey-nearby-d3");
  assert.deepEqual([spawned, child, kind, near, chickenSpawned], [1, 1, 1, 5, 0]);
  assert.deepEqual(kinds.get("b36-jockey-new-d3").slice(1, 6), [1, 1, 2, -1, 1]);
  assert.deepEqual(kinds.get("b36-jockey-new-unloaded-d3").slice(1, 6), [0, 1, 2, -1, 0]);
  assert.deepEqual(kinds.get("b36-jockey-nearby-unloaded-d3").slice(1, 6), [0, 1, 1, 5, 0]);
  assert.deepEqual(kinds.get("b36-jockey-nearby-none-d3").slice(1, 6), [1, 1, 0, -1, 0]);
  assert.equal(rec("b36-jockey-new-d3").chickens.length, 1);
  assert.equal(rec("b36-jockey-new-unloaded-d3").chickens.length, 0);
});

test("village fight b36: the jockey chicken carries its rider and stops laying; the spawned chicken follows the rider's route", () => {
  const r = rec("b36-jockey-new-d3");
  const got = replayFight(r);
  const c = got.extraChickens[0];
  assert.equal(c.chickenJockey, true);
  assert.ok(c.riddenBy && c.riddenBy.type === "zombie");
  // the child roll and the chicken rolls come from World.rand: another seed rolls other things
  assert.ok(diverges("b36-jockey-new-d3", { seed: r.seed + 1 }));
  // no chicken to mount: the nearby-chicken record cannot replay with its chickens moved away
  assert.ok(diverges("b36-jockey-nearby-d3", { pos: rec("b36-jockey-nearby-none-d3").pos }));
  // a spawn into an unloaded chunk is refused: loaded, the same spawn builds a chicken and the world holds more entities
  assert.ok(diverges("b36-jockey-new-unloaded-d3", { unloaded: undefined }));
});

// EntityLivingBase.onUpdate moves the attribute modifiers of a changed held stack at the start of that mob's update: a sword swapped after the mob's own update (equipmid) counts from its next one.
test("village fight b36: held-item swaps change the fights ", () => {
  const script = rec("b36-sword-swap-d3").script;
  // each of the two first swaps matters (player damage changes without them)
  assert.ok(diverges("b36-sword-swap-d3", { script: script.filter((s) => !s.includes("20 equip 3 276")) }));
  assert.ok(diverges("b36-sword-swap-d3", { script: script.filter((s) => !s.includes("equipmid 2 4 267")) }));
  for (const drop of ["0 equip 6 267", "60 equip 6 276", "120 equip 6 0"]) assert.ok(diverges("b36-sword-skeleton-d3", { script: rec("b36-sword-skeleton-d3").script.filter((s) => s !== drop) }), drop);
});

test("village fight b36: the slope, door and storey arenas are all present and their obstacles matter", () => {
  const names = reference.records.map((r) => r.name).join(" ");
  for (const k of ["slope-gate-closed", "slope-gate-open", "slope-gate-edge", "slope-gate-foot", "slope-door-closed", "slope-door-open", "slope-door-step", "flee-storeys", "flee-ramp"]) assert.ok(names.includes(k), k);
  for (const name of ["b36-slope-gate-closed-hunt-d3", "b36-slope-door-closed-d3", "b36-flee-storeys-d3"]) assert.ok(diverges(name, { blocks: [] }), name);
  assert.ok(diverges("b36-slope-gate-open-hunt-d3", { blocks: rec("b36-slope-gate-closed-hunt-d3").blocks }));
});

import test from "node:test";
import assert from "node:assert/strict";
import { zombieWanderReference, replayZombieWander, zombieWanderDivergence } from "./zombie-wander-replay.js";

// public/research/zombie-wander-reference.json (tools/probes/ZombieWanderProbe.java, tools/verify-zombie-wander.mjs): a bare EntityZombie ticked whole on the unchanged
// 1.7.10 classes, 18 records on flat stone, a slope, beside water, in daylight (burning) and set on fire. Position, motion, yaw, pitch, head yaw, body yaw, fire,
// health, every Random call, the path (index and points), the move and look helpers and the running tasks replay exactly. Batch 41's seed 4109 volley zombie is zw-flat-41091.
for (const r of zombieWanderReference) {
  test(`native zombie wander ${r.name}`, () => {
    assert.equal(zombieWanderDivergence(r, replayZombieWander(r)), null);
  });
}

test("the zombie wander records cover flat, slope, water, sun and fire and every one wanders", () => {
  const by = (s) => zombieWanderReference.filter((r) => r.name.startsWith(s));
  assert.equal(zombieWanderReference.length, 18);
  for (const k of ["zw-flat", "zw-slope", "zw-water", "zw-sun", "zw-fire"]) assert.ok(by(k).length >= 2, k);
  for (const r of zombieWanderReference) assert.ok(r.rows.some((x) => x[14] !== null), r.name); // a path was built
  const seed4109 = zombieWanderReference.find((r) => r.name === "zw-flat-41091");
  assert.equal(seed4109.rows.findIndex((x) => x[14] !== null), 15); // the wander starts on tick 15
  assert.ok(by("zw-slope").every((r) => r.rows.some((x) => x[1] > 1))); // the zombie climbs the steps
  assert.ok(by("zw-fire").every((r) => r.rows.some((x) => x[11] > 0))); // the scripted fire burns
  assert.ok(by("zw-sun").every((r) => r.rows.some((x) => x[11] > 0))); // it burns in daylight
});

// The batch 41 volley with seed 4109 (FireballProbe, a blaze hurt by the zombie at tick 3, the zombie wandering from tick 15): the full fireball replay now matches
// it, the wander included (the replay world's light brightness is 15 everywhere, as the probe's).
import { readFileSync } from "node:fs";
import { replayFireballs, fireballDivergence } from "./fireballs-replay.js";
const volley4109 = JSON.parse(readFileSync(new URL("../public/research/fireballs-wander4109-reference.json", import.meta.url))).records;
test("native b41 volley with the wandering zombie (seed 4109) replays exactly", () => {
  assert.equal(volley4109.length, 1);
  const r = volley4109[0];
  assert.equal(r.name, "fb41-blaze-volley-zombie-4109");
  assert.equal(fireballDivergence(r, replayFireballs(r)), null);
  assert.ok(r.rows.some((x) => Math.abs(x[0][1][0] - 72.5) > 0.01)); // the zombie (entity 1) walked
});

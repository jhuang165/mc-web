// Batch 92 mobrec92: executed mob records on the unchanged 1.7.10 classes.
//  - tools/probes/EndermanWolfProbe.java set b92mr (EndermanWolfScenarios.run92, `EW_SET=b92mr node tools/verify-endermanwolf.mjs` -> public/research/enderman-wolf-b92mr-reference.json):
//    the b91mr harness whose loop also ticks the slimes and magma cubes a death spawns (World.updateEntities walks a growing list), plus snow golem, witch and blaze fights.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reference92, replayEndermanWolf, firstDivergence } from "./enderman-wolf-replay.js";
import { mobDrops } from "./combat.js";
import { mobTargets } from "./projectiles.js";
import { WitchPotions } from "./witch-potions.js";
import { JavaRandom } from "./lighting.js";

const recs = reference92.records, by = (s) => recs.find((r) => r.name.includes(s));
const src = (f) => readFileSync(new URL(f, import.meta.url), "utf8");

test("mobrec92: the b92mr reference holds 15 executed records, the split children in row element 12", () => {
  assert.equal(recs.length, 15);
  assert.match(reference92.method, /Batch 92/);
  assert.ok(recs.some((r) => r.kids?.length >= 2), "a record with split children");
  for (const r of recs) assert.ok(r.rows.every((row) => Array.isArray(row[12])), r.name);
});
for (const r of recs) {
  test(`mobrec92: ${r.name} replays with no divergence`, () => {
    assert.equal(JSON.stringify(firstDivergence(r, replayEndermanWolf(r))), "null", r.name);
  });
}
test("mobrec92: firstDivergence catches a changed child row", () => {
  const r = by("golem-slime4-9403"), t = r.rows.findIndex((row) => row[12].length), bad = structuredClone(r);
  bad.rows[t][12][0][0] += 1e-9;
  assert.equal(firstDivergence(bad, replayEndermanWolf(r))?.[1], "child 0");
});

test("mobrec92 slime child: renderYawOffset starts at 0 (Executed, every golem-* and player-* record's kid body yaw at adoption)", () => {
  assert.match(src("./entities.js"), /child\.renderYawOffset = child\.prevRenderYawOffset = 0;/);
  assert.match(src("./entities.js"), /entitySeed\?\.\(child, "slime-split"\)/);
});

test("mobrec92 push order: the server copy pushes at its own place in the list (Executed player-slime4 / player-magma4)", () => {
  const s = src("./entities.js");
  assert.match(s, /afterPlayerSlot\(o\)/);
  assert.equal((s.match(/pend && this\.afterPlayerSlot\(o\)/g) ?? []).length, 2, "push and push87");
});

test("mobrec92 slimeball: a size 1 slime drops this build's Slimeball (460), not 341 (the Water bucket)", () => {
  let n = 0;
  for (let seed = 0; seed < 40; seed++) for (const [id] of mobDrops({ type: "slime", size: 1 }, { playerHit: true }, new JavaRandom(seed))) { assert.equal(id, 460); n++; }
  assert.ok(n > 10);
});

test("mobrec92 projectile box: a size 2 slime is 1.2 wide and high, a size 1 slime 0.6 (Executed snow-slime2-9425: the snowball strikes at y 1.36)", () => {
  const box = (size) => mobTargets([{ type: "slime", size, x: 10, y: 5, z: 10 }], null)[0].box;
  assert.ok(Math.abs(box(2)[4] - box(2)[1] - 1.2) < 1e-6);
  assert.ok(Math.abs(box(2)[3] - box(2)[0] - 1.2) < 1e-6);
  assert.ok(Math.abs(box(1)[4] - box(1)[1] - 0.6) < 1e-6);
  assert.ok(Math.abs(box(4)[3] - box(4)[0] - 2.4) < 1e-6);
});

test("mobrec92 witch target: a mob target answers hasEffect and health from itself (Executed snow-witch-9423: the second throw is 32732 once the first slowed the golem)", () => {
  assert.match(src("./witch-potions.js"), /target\.e\?\.effects\?\.some/);
  const wp = new WitchPotions({ joined() {} }), witch = { x: 134, y: 0, z: 64, yaw: 0, drinking: false, type: "witch" };
  const throwTo = (effects, health) => wp.throwAt(witch, { x: 124, y: 0, z: 64, eyeHeight: 1.7, e: { vx: 0, vz: 0, health, effects } });
  assert.equal(throwTo([], 4).damage, 32698);
  assert.equal(throwTo([{ id: 2, duration: 100, amplifier: 0 }], 4).damage, 32732);
  assert.equal(throwTo([{ id: 2, duration: 100, amplifier: 0 }], 20).damage, 32660);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STUCK_ARROW_PARTS, stuckArrowPlacements, addStuckArrow, stepStuckArrows } from "./stuck-arrows.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/stuck-arrows-reference.json", import.meta.url)));
const f = Math.fround;

test("model boxes match ModelBiped's boxList", () => {
  const model = ref.records.find((r) => r.case === "model");
  assert.equal(model.parts.length, STUCK_ARROW_PARTS.length);
  model.parts.forEach((p, i) => {
    assert.deepEqual(p.point.map(f), STUCK_ARROW_PARTS[i].point.map(f));
    assert.deepEqual(p.cubes, [STUCK_ARROW_PARTS[i].box]);
  });
});

test("placements replay the JVM rows for every probed entity id", () => {
  const sets = ref.records.filter((r) => r.case === "arrows");
  assert.ok(sets.length >= 9);
  for (const set of sets) {
    const got = stuckArrowPlacements(set.id, set.rows.length);
    got.forEach((g, i) => {
      const r = set.rows[i];
      assert.equal(g.part, r.part, `id ${set.id} arrow ${i} part`);
      g.pos.forEach((v, k) => assert.ok(Math.abs(v - f(r.pos[k])) < 1e-6, `id ${set.id} arrow ${i} pos ${k}`));
      assert.ok(Math.abs(g.yaw - f(r.yaw)) < 1e-3, `id ${set.id} arrow ${i} yaw`);
      assert.ok(Math.abs(g.pitch - f(r.pitch)) < 1e-3, `id ${set.id} arrow ${i} pitch`);
    });
  }
});

test("arrow count wraps as a byte and decays by 20 * (30 - count)", () => {
  assert.equal(addStuckArrow(127), -128);
  assert.deepEqual(stepStuckArrows(0, 0), { count: 0, timer: 0 });
  let s = { count: 3, timer: 0 }, ticks = 0;
  while (s.count === 3) { s = stepStuckArrows(s.count, s.timer); ticks++; }
  assert.equal(ticks, 20 * 27);
  assert.equal(s.count, 2);
});

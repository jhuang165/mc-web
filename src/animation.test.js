import { test } from "node:test";
import assert from "node:assert/strict";
import {
  swingPose,
  bobPose,
  limbAngles,
  PlayerAnimation,
  SWING_SECONDS,
} from "./animation.js";
test("legacy swing rests at both ends and follows the recovered translation coefficients", () => {
  for (const t of [0, 1])
    for (const n of Object.values(swingPose(t))) assert.ok(Math.abs(n) < 1e-12);
  const p = swingPose(0.25);
  assert.ok(Math.abs(p.x + 0.4) < 1e-12);
  assert.ok(Math.abs(p.rx + (80 * Math.PI) / 180) < 1e-12);
  assert.equal(SWING_SECONDS, 0.3);
});
test("view bobbing rests when idle and legs alternate in opposite pairs", () => {
  assert.deepEqual(bobPose(1, 0), { x: 0, y: -0, rx: 0, rz: 0 });
  const [a, b, c, d] = limbAngles(0, 0.5);
  assert.ok(Math.abs(a + b) < 1e-12);
  assert.equal(a, d);
  assert.equal(b, c);
});
test("equip transitions lower the previous item before swapping and raising the new item", () => {
  const a = new PlayerAnimation();
  for (let i = 0; i < 5; i++) a.frame(0.05, { item: 1 });
  assert.equal(a.displayed, 1);
  assert.ok(a.equipped > 0.9);
  a.frame(0.05, { item: 3 });
  assert.equal(a.displayed, 1);
  assert.ok(a.equipped < 0.7);
  for (let i = 0; i < 8; i++) a.frame(0.05, { item: 3 });
  assert.equal(a.displayed, 3);
  assert.ok(Math.abs(a.equipped - 1) < 1e-12);
});

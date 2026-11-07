import { test } from "node:test";
import assert from "node:assert/strict";
import * as K from "./debug-keys.js";

test("hitbox is the unexpanded width/height box at the feet (bytecode-read bnn.b)", () => {
  const b = K.hitboxOf(10, 64, -3, 0.6, 1.8);
  assert.deepEqual(b.map((v) => +v.toFixed(5)), [9.7, 64, -3.3, 10.3, 65.8, -2.7]);
  assert.equal(K.HITBOX_COLOR, 0xffffff);
});

test("outline: two 5-vertex strips then four verticals, 24 vertices as line segments", () => {
  const s = K.outlineSegments([0, 0, 0, 1, 2, 3]);
  assert.equal(s.length, 24);
  assert.deepEqual(s[0], [0, 0, 0]); assert.deepEqual(s[1], [1, 0, 0]);
  assert.deepEqual(s[6], [0, 0, 3]); assert.deepEqual(s[7], [0, 0, 0]); // strip closes on the first vertex
  assert.deepEqual(s[8], [0, 2, 0]);
  assert.deepEqual(s.slice(16, 18), [[0, 0, 0], [0, 2, 0]]);
  assert.ok(s.slice(16).every((p, i) => i % 2 === 0 ? p[1] === 0 : p[1] === 2));
});

test("collectHitboxes covers mobs (calves halved), items, orbs, carts, boats, hanging, projectiles, player", () => {
  const boxes = K.collectHitboxes({
    mobs: [{ type: "pig", x: 0, y: 0, z: 0 }, { type: "pig", x: 0, y: 0, z: 0, growingAge: -1 }, { type: "pig", x: 9, y: 0, z: 9, invisible: true }],
    items: [{ x: 0, y: 1, z: 0 }], orbs: [{ x: 0, y: 0, z: 0 }], carts: [{ bb: [0, 0, 0, 1, 0.7, 1] }], boats: [{ x: 0, y: 0, z: 0 }],
    hanging: [{ x: 0, y: 0, z: 0 }], arrows: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0, dead: true }], balls: [{ x: 0, y: 0, z: 0 }], player: { x: 0, y: 0, z: 0 },
  });
  assert.equal(boxes.length, 10);
  assert.ok(Math.abs(boxes[0][3] - boxes[0][0] - 0.9) < 1e-6 && Math.abs(boxes[0][4] - 0.9) < 1e-6);
  assert.ok(Math.abs(boxes[1][3] - boxes[1][0] - 0.45) < 1e-6);
  assert.deepEqual(K.collectHitboxes({ player: null }), []);
});

test("F3+C crash timer follows bao: arm when both down, reset on release, fire at 6000 ms", () => {
  let r = K.crashStep(-1, 1000, true, false);
  assert.equal(r.stamp, -1);
  r = K.crashStep(-1, 1000, true, true); assert.equal(r.stamp, 1000);
  r = K.crashStep(r.stamp, 6999, true, true); assert.deepEqual(r, { stamp: 1000, crash: false });
  assert.equal(K.crashStep(1000, 3000, false, true).stamp, -1);
  assert.deepEqual(K.crashStep(1000, 7000, true, true), { stamp: 1000, crash: true });
  assert.equal(K.crashStep(1000, 7000, false, true).crash, true); // the check precedes the key test
  assert.equal(K.CRASH_HOLD_MS, 6000);
});

test("crash report carries the native description", () => {
  const t = K.crashReport(new Date(0));
  assert.match(t, /Description: Manually triggered debug crash/);
  assert.match(t, /java\.lang\.Throwable/);
});

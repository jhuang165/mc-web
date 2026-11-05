// ModelDragon pose maths and box table (bytecode not available: written from the 1.7.10 source, see dragon-renderer.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dragonPose, DRAGON_MODEL, DRAGON_TEXTURES } from "./dragon-renderer.js";

const ring = (n) => [-n * 4, 100 - n * 0.1];

test("pose: five neck pieces, twelve tail pieces, a straight dragon has no head turn", () => {
  const straight = (n) => [10, 100];
  const p = dragonPose(straight, 0.25);
  assert.equal(p.necks.length, 5);
  assert.equal(p.tails.length, 12);
  assert.equal(p.head.angle[1], 0);
  assert.equal(p.head.angle[2], -0);
  assert.equal(p.f11, 0);
  // the neck climbs along -z by 10 px per piece when flat
  assert.ok(p.head.point[2] < -40 && p.head.point[2] > -70);
  assert.ok(p.tails[11].point[2] > 60 - 120 && Number.isFinite(p.tails[11].point[2]));
});

test("pose: turning dragon bends the body and the animation clock flaps the wings", () => {
  const a = dragonPose(ring, 0), b = dragonPose(ring, 0.25);
  assert.notEqual(a.f11, 0);
  assert.notEqual(a.wing.z, b.wing.z);
  assert.ok(Math.abs(a.jaw - 0.2) < 1e-9);
});

test("model table: sizes of the original boxes, textures", () => {
  assert.deepEqual(DRAGON_MODEL.body.boxes[0].slice(0, 6), [-12, 0, -16, 24, 24, 64]);
  assert.equal(DRAGON_MODEL.wing.boxes[0][3], 56);
  assert.equal(DRAGON_MODEL.rearfoot.boxes[0][5], 24);
  assert.match(DRAGON_TEXTURES.skin, /enderdragon\/dragon\.png$/);
});

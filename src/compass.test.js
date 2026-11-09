import { test } from "node:test";
import assert from "node:assert/strict";
import { compassAngle, createCompass, tickCompass } from "./compass.js";

test("the compass settles toward the world spawn as the player turns", () => {
  const compass = createCompass(), position = { x: -12, z: 33 };
  const spawn = [-12, 64, 18];
  for (const [yaw, expected] of [[180, 16], [270, 8], [0, 0], [90, 24]]) {
    for (let i = 0; i < 250; i++) tickCompass(compass, compassAngle(position, yaw, spawn, true));
    assert.ok(Math.abs(Math.sin((compass.frame - expected) * Math.PI / 32)) <= Math.sin(Math.PI / 32) + 1e-12);
  }
});

test("the Nether and End use the random angle, with the native clamp and damping", () => {
  const compass = createCompass();
  const angle = compassAngle({ x: 500, z: -20 }, 91, undefined, false, () => 0.25);
  assert.equal(angle, Math.fround(Math.PI) / 2);
  assert.equal(tickCompass(compass, angle), 0);
  assert.equal(compass.velocity, 0.1 * 0.8);
  assert.equal(tickCompass(compass, angle), 1);
  assert.equal(compass.velocity, (0.1 * 0.8 + 0.1) * 0.8);
});

test("a moving, turning player matches 80 frames from the original TextureCompass", () => {
  const expected = [
    0, 1, 2, 3, 4, 6, 7, 9, 11, 13, 14, 16, 18, 20, 21, 22, 23, 24, 24, 24,
    24, 24, 24, 24, 23, 23, 23, 23, 23, 23, 23, 23, 23, 24, 24, 24, 24, 25, 25, 25,
    26, 26, 27, 27, 27, 28, 28, 29, 29, 29, 30, 30, 31, 31, 0, 0, 1, 1, 2, 2,
    3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 10, 10, 11, 11, 12, 12,
  ];
  const compass = createCompass();
  for (const [i, frame] of expected.entries()) {
    const position = { x: -12.5 + i * 0.25, z: 33.75 - i * 0.5 };
    assert.equal(tickCompass(compass, compassAngle(position, 183 - 6 * i, [-12, 64, 18], true)), frame, `tick ${i}`);
  }
});

test("without a spawn yet (a gun server tab before its spawn arrives) the needle spins instead of throwing", () => {
  assert.equal(compassAngle({ x: 1, z: 2 }, 0, null, true, () => 0.5), 0.5 * Math.fround(Math.PI) * 2);
});

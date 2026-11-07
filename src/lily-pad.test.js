import test from "node:test";
import assert from "node:assert/strict";
import { lilyPadRotation, lilyPadQuad, lilyPadCornerUv } from "./lily-pad.js";

// i1 of RenderBlocks.renderBlockLilyPad (blm.o) computed by Java 32/64-bit arithmetic from the bytecode expression
// (int)(x * 3129871) ^ (long)z * 116129781L ^ (long)y; l = l * l * 42317861L + l * 11L; (int)(l >> 16 & 3L).
const JAVA = [[0,63,0,3],[1,63,0,2],[0,63,1,1],[-1,63,-1,2],[5,62,7,3],[100,63,-200,0],[-3000,64,12345,0],[123456,62,-654321,0],[1000000,63,1000000,3],[-1000000,63,-1000000,3],[29999984,63,-29999984,1],[2,63,2,3],[3,63,3,1],[-7,60,9,0],[40,63,-41,3],[-12,65,88,2]];
test("lily pad rotation hash equals the native int/long arithmetic", () => {
  for (const [x, y, z, i1] of JAVA) assert.equal(lilyPadRotation(x, y, z), i1, `${x},${y},${z}`);
});
test("all four rotations occur over a pond", () => {
  const seen = new Set();
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) seen.add(lilyPadRotation(x, 62, z));
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
});
test("quad vertices follow the bytecode for each rotation", () => {
  assert.deepEqual(lilyPadQuad(0), [[-0.5, 0.5, 0, 0], [0.5, 0.5, 1, 0], [0.5, -0.5, 1, 1], [-0.5, -0.5, 0, 1]]);
  assert.deepEqual(lilyPadQuad(1), [[0.5, 0.5, 0, 0], [0.5, -0.5, 1, 0], [-0.5, -0.5, 1, 1], [-0.5, 0.5, 0, 1]]);
  assert.deepEqual(lilyPadQuad(2), [[0.5, -0.5, 0, 0], [-0.5, -0.5, 1, 0], [-0.5, 0.5, 1, 1], [0.5, 0.5, 0, 1]]);
  assert.deepEqual(lilyPadQuad(3), [[-0.5, -0.5, 0, 0], [-0.5, 0.5, 1, 0], [0.5, 0.5, 1, 1], [0.5, -0.5, 0, 1]]);
  for (let r = 0; r < 4; r++) {
    const corners = lilyPadQuad(r).map(([dx, dz]) => `${dx},${dz}`).sort();
    assert.deepEqual(corners, ["-0.5,-0.5", "-0.5,0.5", "0.5,-0.5", "0.5,0.5"]);
  }
});
test("a corner's texture selectors follow its cell's rotation", () => {
  // (0, 63, 0) is rotation 3: the (-x, -z) corner is minU/minV.
  assert.deepEqual(lilyPadCornerUv(0, 63, 0, 0, 0), [0, 0]);
  assert.deepEqual(lilyPadCornerUv(0, 63, 0, 0, 1), [1, 0]);
  assert.deepEqual(lilyPadCornerUv(0, 63, 0, 1, 1), [1, 1]);
  assert.deepEqual(lilyPadCornerUv(0, 63, 0, 1, 0), [0, 1]);
});

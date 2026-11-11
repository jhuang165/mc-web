// The block atlas follows the executed 1.7.10 Stitcher layout (public/research/stitcher-reference.json, tools/verify-stitcher.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { TILES, TILE_ORIGINS, ATLAS_WIDTH, ATLAS_HEIGHT, tileRect, tileAtUv, tileOrigin, spriteUv } from "./block-textures.js";
import { NATIVE_BLOCK_SPRITES, NATIVE_ATLAS_WIDTH, NATIVE_ATLAS_HEIGHT } from "./atlas-layout.js";

const ref = JSON.parse(await readFile(new URL("../public/research/stitcher-reference.json", import.meta.url)));
const F = Math.fround, blocks = ref.atlases.blocks, byName = new Map(blocks.sprites.map((s) => [s.name, { ...s, minU: F(s.minU), maxU: F(s.maxU), minV: F(s.minV), maxV: F(s.maxV) }])); // Java prints the shortest float text

test("atlas-layout.js is the executed block atlas", () => {
  assert.equal(NATIVE_ATLAS_WIDTH, blocks.width);
  assert.equal(NATIVE_ATLAS_HEIGHT, blocks.height);
  assert.deepEqual(Object.keys(NATIVE_BLOCK_SPRITES), blocks.sprites.map((s) => s.name));
  for (const s of blocks.sprites) assert.deepEqual(NATIVE_BLOCK_SPRITES[s.name], [s.x, s.y, s.w], s.name);
  assert.deepEqual(ref.atlases.blocks.mipLevelsChecked, [0, 1, 2, 3, 4]);
  assert.deepEqual(ref.atlases.items.mipLevelsChecked, [0, 1, 2, 3, 4]);
});

test("the Stitcher's own slots do not overlap and the sprites sit on the executed positions", () => {
  const seen = new Map();
  for (const s of blocks.sprites) for (let y = s.y; y < s.y + s.h; y += 16) for (let x = s.x; x < s.x + s.w; x += 16) {
    assert.ok(!seen.has(x + "," + y), `${s.name} overlaps ${seen.get(x + "," + y)}`); seen.set(x + "," + y, s.name);
  }
  assert.ok(blocks.sprites.every((s) => s.x + s.w <= blocks.width && s.y + s.h <= blocks.height));
});

test("every tile named like a native sprite is at its Stitcher position with getMinU/getMaxU/getMinV/getMaxV as uv", () => {
  assert.equal(ATLAS_WIDTH, blocks.width);
  assert.equal(ATLAS_HEIGHT, blocks.height, "the port-only tiles fit in the native atlas' free cells");
  let native = 0;
  TILES.forEach((name, i) => {
    const s = byName.get(name);
    if (!s) return;
    native++;
    assert.deepEqual(tileOrigin(i), [s.x, s.y], name);
    const r = tileRect(i);
    assert.equal(r.u0, s.minU, name + " minU"); assert.equal(r.u1, s.maxU, name + " maxU");
    assert.equal(r.v0, 1 - s.maxV, name + " maxV"); assert.equal(r.v1, 1 - s.minV, name + " minV");
    assert.deepEqual(spriteUv(s.x, s.y, s.w, s.h, blocks.width, blocks.height), { minU: s.minU, maxU: s.maxU, minV: s.minV, maxV: s.maxV }, name + " float formula");
  });
  assert.ok(native >= TILES.length - 3, "only the chest faces are port-only");
});

test("port-only tiles take free cells and every tile cell is distinct", () => {
  const cells = new Set(TILE_ORIGINS.map((o) => o.join(",")));
  assert.equal(cells.size, TILES.length);
  TILES.forEach((name, i) => {
    if (byName.has(name)) return;
    const [x, y] = TILE_ORIGINS[i];
    for (const s of blocks.sprites) assert.ok(x + 16 <= s.x || x >= s.x + s.w || y + 16 <= s.y || y >= s.y + s.h, `${name} overlaps ${s.name}`);
  });
});

test("tileAtUv inverts tileRect, explicit insets stay geometric, and the mip chain stays inside the cell", () => {
  TILES.forEach((name, i) => {
    const r = tileRect(i);
    assert.equal(tileAtUv((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2), i, name);
    const g = tileRect(i, 0), [x, y] = tileOrigin(i);
    assert.equal(g.u0 * ATLAS_WIDTH, x); assert.equal(g.u1 * ATLAS_WIDTH, x + 16);
    assert.ok(Math.abs((1 - g.v1) * ATLAS_HEIGHT - y) < 1e-9);
    // Cells are 16 aligned, so every mip level up to 4 keeps a sprite's texels inside its own (x >> l, y >> l) block.
    assert.ok(x % 16 === 0 && y % 16 === 0);
  });
});

test("the native inset is 0.01 texel (float arithmetic), not the old 0.02", () => {
  const r = tileRect(0), [x] = tileOrigin(0);
  const texel = (r.u0 * ATLAS_WIDTH - x);
  assert.ok(Math.abs(texel - 0.01) < 1e-4, String(texel));
});

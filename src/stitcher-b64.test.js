// The ported Stitcher reproduces the executed 1.7.10 Stitcher: the vanilla block and item sets and the HD / mixed-size cases of tools/probes/StitcherProbe.java.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stitch, mipSize, roundUpPow2, log2Ceil, mipLevelsFor } from "./stitcher.js";

const ref = JSON.parse(await readFile(new URL("../public/research/stitcher-reference.json", import.meta.url)));

test("vanilla sets stitch to the executed positions (every mipmap level)", () => {
  for (const type of ["blocks", "items"]) {
    const a = ref.atlases[type], mips = a.mipLevelsChecked;
    for (const mip of mips) {
      const out = stitch(a.sprites.map((s) => ({ name: s.name, width: s.w, height: s.h })), { mip });
      assert.equal(out.width, a.width); assert.equal(out.height, a.height);
      const got = new Map(out.sprites.map((s) => [s.name, s]));
      assert.equal(got.size, a.sprites.length);
      for (const s of a.sprites) { const g = got.get(s.name); assert.deepEqual([g.x, g.y, g.rotated], [s.x, s.y, false], `${type} ${s.name} mip ${mip}`); }
    }
  }
});

test("HD and mixed-size cases match the executed Stitcher (positions, atlas size, mip level limit, rotation flag)", () => {
  assert.equal(ref.hdCases.length, 32);
  const sizes = new Set();
  for (const c of ref.hdCases) {
    const input = c.input.map(([name, size]) => ({ name, width: size, height: size }));
    const out = stitch(input, { mip: c.mip }), label = `${c.type} ${c.rule} mip ${c.mip}`;
    assert.deepEqual([out.width, out.height], [c.width, c.height], label);
    assert.equal(mipLevelsFor(input.map((s) => s.width), c.mip), c.levels, label + " levels");
    const got = new Map(out.sprites.map((s) => [s.name, s]));
    assert.equal(got.size, c.sprites.length, label);
    for (const [name, x, y, w, h] of c.sprites) { const g = got.get(name); assert.deepEqual([g.x, g.y, g.w, g.h, g.rotated], [x, y, w, h, false], `${label} ${name}`); }
    for (const [, , , w] of c.sprites) sizes.add(w);
  }
  assert.ok([8, 16, 32, 64, 128].every((s) => sizes.has(s)), "cases cover 8 to 128 px sprites");
});

test("the slots never overlap and every sprite lies inside the power-of-two atlas", () => {
  for (const c of ref.hdCases.filter((c) => c.mip === 0)) {
    const out = stitch(c.input.map(([name, size]) => ({ name, width: size, height: size })));
    assert.equal(out.width & (out.width - 1), 0); assert.equal(out.height & (out.height - 1), 0);
    const occupied = new Set(), unit = Math.min(...c.input.map((i) => i[1]));
    for (const s of out.sprites) {
      assert.ok(s.x + s.w <= out.width && s.y + s.h <= out.height, s.name);
      for (let y = s.y; y < s.y + s.h; y += unit) for (let x = s.x; x < s.x + s.w; x += unit) { const k = x + "," + y; assert.ok(!occupied.has(k), `${c.rule} ${s.name} overlaps`); occupied.add(k); }
    }
  }
});

test("helpers follow MathHelper and Stitcher.getMipLevelSize", () => {
  assert.deepEqual([0, 1, 3, 16, 17, 100].map(roundUpPow2), [0, 1, 4, 16, 32, 128]);
  assert.deepEqual([1, 8, 16, 17, 32].map(log2Ceil), [0, 3, 4, 5, 5]);
  assert.deepEqual([[16, 4], [18, 4], [8, 4], [33, 2]].map(([x, l]) => mipSize(x, l)), [16, 32, 16, 36]);
  assert.equal(mipLevelsFor([32, 64], 4), 4, "missingno (16 px) is always in the set");
  assert.equal(mipLevelsFor([8, 64], 4), 3);
  assert.equal(mipLevelsFor([32], 2), 2);
});

test("a sprite that cannot fit throws the native message", () => {
  assert.throws(() => stitch([{ name: "big", width: 32, height: 32 }], { maxSize: 16 }), /Unable to fit: big - size: 32x32 - Maybe try a lowerresolution resourcepack\?/);
});

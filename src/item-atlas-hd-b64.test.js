// HD resource packs stitch the item and block sprite sheets at their own sprite sizes (stitcher.js), and the block-atlas items are cells of the blocks sheet,
// checked against the executed Stitcher (hdCases) and the executed Item.getSpriteNumber() of every registered item (spriteNumbers).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { sheetLayout, spriteUvOf, itemSpriteUv, blockSpriteUv, itemSpriteName, blockSpriteName, itemAtlasTexture, itemSpriteTransform, blockSpriteTransform } from "./item-atlas.js";
import { NATIVE_ITEM_SPRITES } from "./item-atlas-layout.js";
import { NATIVE_BLOCK_SPRITES } from "./atlas-layout.js";
import { entityMaterial, liveSpriteTransform } from "./light-material.js";

const ref = JSON.parse(await readFile(new URL("../public/research/stitcher-reference.json", import.meta.url))), F = Math.fround;

test("with vanilla sprite sizes both sheets are the executed layouts and uv", () => {
  for (const [kind, key] of [["items", "items"], ["blocks", "blocks"]]) {
    const l = sheetLayout(kind), a = ref.atlases[key];
    assert.equal(l.hd, false); assert.deepEqual([l.width, l.height], [a.width, a.height]);
    for (const s of a.sprites) {
      assert.deepEqual(l.cells.get(s.name), [s.x, s.y, s.w, s.h], s.name);
      assert.deepEqual(spriteUvOf(l.cells.get(s.name), l), { minU: F(s.minU), maxU: F(s.maxU), minV: F(s.minV), maxV: F(s.maxV) }, s.name);
    }
  }
  assert.deepEqual(blockSpriteUv("stone"), spriteUvOf(sheetLayout("blocks").cells.get("stone"), sheetLayout("blocks")));
  assert.equal(itemSpriteUv("apple").minU, F(F(0) + F(0.009999999776482582 / 256)));
});

test("sprite sizes seen from an HD pack re-stitch the sheet: executed positions and initSprite uv", () => {
  let checked = 0;
  for (const c of ref.hdCases.filter((c) => c.mip === 0)) {
    const known = new Map(c.input.map(([name, size]) => [name, [size, size]])), l = sheetLayout(c.type, known);
    assert.deepEqual([l.width, l.height], [c.width, c.height], `${c.type} ${c.rule}`);
    for (const s of c.sprites) {
      const [name, x, y, w, h, minU, maxU, minV, maxV] = s, cell = l.cells.get(name);
      assert.deepEqual(cell, [x, y, w, h], `${c.type} ${c.rule} ${name}`);
      if (minU !== undefined) { assert.deepEqual(spriteUvOf(cell, l), { minU: F(minU), maxU: F(maxU), minV: F(minV), maxV: F(maxV) }, `${c.type} ${c.rule} ${name} uv`); checked++; }
    }
  }
  assert.equal(checked, 16 * 6);
});

test("an unseen sprite keeps its vanilla size, so one HD sprite only moves what the Stitcher moves", () => {
  const known = new Map([["apple", [32, 32]]]), l = sheetLayout("items", known);
  assert.equal(l.hd, true);
  assert.deepEqual(l.cells.get("apple").slice(2), [32, 32]);
  assert.deepEqual(l.cells.get("arrow").slice(2), [16, 16]);
  assert.equal(sheetLayout("items", new Map([["apple", [16, 16]]])).hd, false, "a pack sprite at the vanilla size keeps the executed layout");
  assert.equal(sheetLayout("blocks", new Map([["lava_flow", [32, 32]]])).hd, false, "lava_flow is 32 px natively");
});

test("block-atlas urls are laid-out sprites of the blocks sheet; item urls stay on the items sheet", () => {
  assert.equal(blockSpriteName("/media/1.7.10/blocks/flower_dandelion.png"), "flower_dandelion");
  assert.equal(blockSpriteName("/media/1.7.10/blocks/torch_on.png?r=2"), "torch_on");
  assert.equal(blockSpriteName("/media/1.7.10/blocks/not_a_sprite.png"), null);
  assert.equal(itemSpriteName("/media/1.7.10/blocks/web.png"), null);
  assert.equal(blockSpriteName("/media/1.7.10/items/apple.png"), null);
  assert.equal(itemAtlasTexture("/media/1.7.10/blocks/web.png"), null, "no DOM here");
  const [sx, sy, ox, oy] = blockSpriteTransform("web"), uv = blockSpriteUv("web");
  assert.equal(ox, uv.minU); assert.equal(ox + sx, uv.maxU); assert.equal(oy, 1 - uv.maxV);
  assert.ok(itemSpriteTransform("apple").length === 4);
});

test("a sprite texture's uv vector is shared with the materials, so a re-stitch moves them", () => {
  const tex = new THREE.Texture(); tex.userData.st = new THREE.Vector4(0.5, 0.5, 0.25, 0.25);
  assert.equal(liveSpriteTransform(tex), tex.userData.st);
  assert.deepEqual(liveSpriteTransform(new THREE.Texture()).toArray(), [1, 1, 0, 0]);
  const lighting = { uniforms: { lightmap: { value: null }, fogColor: { value: new THREE.Vector3() }, fogNear: { value: 1 }, fogFar: { value: 2 }, fogDensity: { value: 0 } } };
  const m = entityMaterial(lighting, { map: tex });
  tex.userData.st.set(0.125, 0.125, 0.5, 0.5);
  assert.deepEqual(m.uniforms.mapST.value.toArray(), [0.125, 0.125, 0.5, 0.5]);
});

test("Item.getSpriteNumber (executed): every item with a block id draws from the block atlas, except the hopper; no item of the item atlas is a block", () => {
  const sn = ref.spriteNumbers, blockSet = new Set(ref.atlases.blocks.sprites.map((s) => s.name)), itemSet = new Set(ref.atlases.items.sprites.map((s) => s.name));
  assert.ok(sn.length > 300);
  const zero = sn.filter((x) => x[2] === 0), ones = sn.filter((x) => x[2] === 1);
  assert.ok(zero.every(([id]) => id < 256), "sprite number 0 only for block items");
  assert.deepEqual(sn.filter(([id, , n]) => id < 256 && n === 1).map((x) => x[0]), [154], "the hopper is the one ItemBlock registered on the items map");
  assert.ok(ones.every(([id]) => id >= 256 || id === 154));
  assert.ok(itemSet.has("hopper") && !blockSet.has("hopper"));
  // the port's flat block items: the block ids RenderItem draws as sprites take their icon from the blocks sheet (or a tinted data url), never an items cell
  for (const name of ["flower_dandelion", "torch_on", "web", "iron_bars", "lever", "sapling_oak", "redstone_torch_on", "trip_wire_source"]) {
    assert.ok(blockSet.has(name) && Object.hasOwn(NATIVE_BLOCK_SPRITES, name) && !Object.hasOwn(NATIVE_ITEM_SPRITES, name), name);
  }
});

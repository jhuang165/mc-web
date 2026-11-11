// The item atlas follows the executed 1.7.10 Stitcher (public/research/stitcher-reference.json, tools/verify-stitcher.mjs): layout, TextureAtlasSprite uv with the 0.01 px
// inset, and the uv window the item materials apply.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { NATIVE_ITEM_SPRITES, NATIVE_ITEM_ATLAS_WIDTH, NATIVE_ITEM_ATLAS_HEIGHT } from "./item-atlas-layout.js";
import { itemSpriteName, itemSpriteUv, itemSpriteTransform, itemAtlasTexture } from "./item-atlas.js";
import { entityMaterial, applySpriteTransform } from "./light-material.js";

const ref = JSON.parse(await readFile(new URL("../public/research/stitcher-reference.json", import.meta.url))).atlases.items, F = Math.fround;

test("item-atlas-layout.js is the executed item atlas", () => {
  assert.equal(NATIVE_ITEM_ATLAS_WIDTH, ref.width); assert.equal(NATIVE_ITEM_ATLAS_HEIGHT, ref.height);
  assert.equal(ref.sprites.length, 212);
  assert.deepEqual(Object.keys(NATIVE_ITEM_SPRITES), ref.sprites.map((s) => s.name));
  const seen = new Map();
  for (const s of ref.sprites) {
    assert.deepEqual(NATIVE_ITEM_SPRITES[s.name], [s.x, s.y, s.w], s.name);
    for (let y = s.y; y < s.y + s.h; y += 16) for (let x = s.x; x < s.x + s.w; x += 16) { assert.ok(!seen.has(x + "," + y), `${s.name} overlaps ${seen.get(x + "," + y)}`); seen.set(x + "," + y, s.name); }
  }
});

test("every sprite's uv is getMinU/getMaxU/getMinV/getMaxV after initSprite (float32, 0.01 px inset)", () => {
  for (const s of ref.sprites) {
    const uv = itemSpriteUv(s.name);
    assert.deepEqual(uv, { minU: F(s.minU), maxU: F(s.maxU), minV: F(s.minV), maxV: F(s.maxV) }, s.name);
    // nearest sampling of the first and last coordinate stays inside the sprite's own 16 x 16 cell
    for (const [u, v] of [[uv.minU, uv.minV], [uv.maxU, uv.maxV]]) {
      const tx = Math.floor(u * ref.width), ty = Math.floor(v * ref.height);
      assert.ok(tx >= s.x && tx < s.x + s.w && ty >= s.y && ty < s.y + s.h, s.name);
    }
  }
});

test("item urls resolve to sprite names; other urls and versioned urls behave", () => {
  assert.equal(itemSpriteName("/media/1.7.10/items/apple.png"), "apple");
  assert.equal(itemSpriteName("/media/1.7.10/items/apple.png?r=3"), "apple");
  assert.equal(itemSpriteName("/media/1.7.10/blocks/stone.png"), null);
  assert.equal(itemSpriteName("/media/1.7.10/items/nonsense.png"), null);
  assert.equal(itemSpriteName("data:image/png;base64,AAAA"), null);
  assert.equal(itemAtlasTexture("/media/1.7.10/items/apple.png"), null, "no DOM here: the plain texture path stays");
});

test("the uv transform maps the texture's 0..1 window onto the flipped native rectangle, and entityMaterial follows uniforms.map.value", () => {
  const [sx, sy, ox, oy] = itemSpriteTransform("apple"), uv = itemSpriteUv("apple");
  assert.equal(ox, uv.minU); assert.equal(ox + sx, uv.maxU);
  assert.equal(oy, 1 - uv.maxV); assert.ok(Math.abs(oy + sy - (1 - uv.minV)) < 1e-6);
  const tex = new THREE.Texture(); tex.userData.st = new THREE.Vector4(sx, sy, ox, oy);
  const lighting = { uniforms: { lightmap: { value: null }, fogColor: { value: new THREE.Vector3() }, fogNear: { value: 1 }, fogFar: { value: 2 }, fogDensity: { value: 0 } } };
  const m = entityMaterial(lighting, { map: tex });
  assert.deepEqual(m.uniforms.mapST.value.toArray(), new THREE.Vector4(sx, sy, ox, oy).toArray());
  m.uniforms.map.value = new THREE.Texture();
  assert.deepEqual(m.uniforms.mapST.value.toArray(), [1, 1, 0, 0]);
  m.uniforms.map.value = tex;
  assert.equal(m.uniforms.mapST.value.z, ox);
  assert.deepEqual(applySpriteTransform(null, new THREE.Vector4()).toArray(), [1, 1, 0, 0]);
});

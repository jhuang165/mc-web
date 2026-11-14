// Batch 66: one blocks map for the item renderer and the chunks, and uvs baked from the terrain layout follow a layout change (resource pack switch).
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import * as bt from "./block-textures.js";
import { bindTerrainAtlas, itemAtlasTexture, blockSpriteUv, blockSpriteTransform, terrainSiblingCount } from "./item-atlas.js";
import { blockCubeGeometry, cactusItemGeometry, stairItemGeometry } from "./first-person.js";
import { displayGeometry } from "./cart-display-shape.js";
import { trackCubeUv, trackUvArray, trackedCount } from "./uv-rebake.js";
import { itemPasses } from "./item-passes.js";
import { meshAnaglyph } from "./anaglyph.js";
const { itemFromOriginal } = await import("./region-import.js");

const HD = { stone: 64, dirt: 64, planks_oak: 32, planks_birch: 32, cactus_side: 32, cactus_top: 32, cactus_bottom: 32 };
const reset = () => bt.setTerrainSizes(new Map());
const snap = (g) => Array.from(g.attributes.uv.array);
const near = (a, b, msg) => { assert.equal(a.length, b.length, msg); a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${msg} [${i}] ${v} vs ${b[i]}`)); };

test("flatBlockTileUrl and its implementation are gone", () => {
  assert.equal(bt.flatBlockTileUrl, undefined);
  assert.equal(bt.terrainLayoutVersion(), 0);
});

test("block sprites of the item renderer are cells of the terrain atlas and follow its layout", () => {
  const terrain = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  terrain.minFilter = THREE.NearestMipmapLinearFilter; terrain.flipY = true;
  const fake = { terrain };
  bindTerrainAtlas(fake);
  const url = "/media/1.7.10/blocks/stone.png", tex = itemAtlasTexture(url);
  assert.ok(tex && tex.userData.terrainSibling);
  assert.equal(itemAtlasTexture(url), tex, "one texture per sprite");
  assert.equal(tex.source, terrain.source, "one Source: the sheet uploads once");
  assert.equal(tex.minFilter, THREE.NearestMipmapLinearFilter); assert.equal(tex.flipY, true);
  terrain.minFilter = THREE.NearestFilter; assert.equal(tex.minFilter, THREE.NearestFilter, "filters mirror the atlas");
  const check = () => {
    const i = bt.tileByName("stone"), r = bt.tileRect(i), st = tex.userData.st;
    near([st.x, st.y, st.z, st.w], [r.u1 - r.u0, r.v1 - r.v0, r.u0, r.v0], "st = tileRect");
    const uv = blockSpriteUv("stone"), tr = blockSpriteTransform("stone");
    near([uv.minU, uv.maxU, 1 - uv.maxV, 1 - uv.minV], [r.u0, r.u1, r.v0, r.v1], "blockSpriteUv");
    near(tr, [st.x, st.y, st.z, st.w], "transform");
  };
  check();
  const before = Array.from(tex.userData.st.toArray());
  assert.equal(bt.setTerrainSizes(HD), true);
  check();
  assert.notDeepEqual(Array.from(tex.userData.st.toArray()), before, "HD layout moved the sprite");
  assert.ok(terrainSiblingCount() >= 1);
  // a layout change disposes the shared GL texture's siblings along with the terrain texture
  let disposed = 0; tex.addEventListener("dispose", () => disposed++);
  terrain.dispose(); assert.equal(disposed, 1);
  reset(); check();
  // a tile the atlas does not have keeps the private-sheet path (no DOM here: null)
  assert.equal(itemAtlasTexture("/media/1.7.10/items/stick.png"), null);
});

test("every cached uv bake follows a layout change", () => {
  reset();
  const planks = bt.blockTile(5, 0, false, 2), cases = {
    cube: [blockCubeGeometry(1, 0, 0.25), () => blockCubeGeometry(1, 0, 0.25)],
    cubeGrass: [blockCubeGeometry(2, 0, 0.25), () => blockCubeGeometry(2, 0, 0.25)],
    cactus: [cactusItemGeometry(1), () => cactusItemGeometry(1)],
    stairs: [stairItemGeometry(53, 1), () => stairItemGeometry(53, 1)],
    hopper: [displayGeometry("hopper", { id: 154, meta: 0 }), () => displayGeometry("hopper", { id: 154, meta: 0 })],
    planksCube: [trackCubeUv(new THREE.BoxGeometry(1, 1, 1), () => planks), () => trackCubeUv(new THREE.BoxGeometry(1, 1, 1), () => planks)],
    carriedBlock: [trackCubeUv(new THREE.BoxGeometry(1, 1, 1), (f) => bt.blockTile(1, f, false, 0), 0), () => trackCubeUv(new THREE.BoxGeometry(1, 1, 1), (f) => bt.blockTile(1, f, false, 0), 0)],
  };
  const old = Object.fromEntries(Object.entries(cases).map(([k, [g]]) => [k, snap(g)]));
  const count = trackedCount();
  assert.ok(count >= Object.keys(cases).length);
  assert.equal(bt.setTerrainSizes(HD), true);
  for (const [k, [g, build]] of Object.entries(cases)) {
    near(snap(g), snap(build()), k + " rebaked to the new layout");
    if (k !== "cubeGrass") assert.notDeepEqual(snap(g), old[k], k + " changed");
  }
  reset();
  for (const [k, [g]] of Object.entries(cases)) near(snap(g), old[k], k + " back on the vanilla layout");
});

test("trackUvArray replaces the attribute and keeps the geometry alive weakly", () => {
  let n = 0; const g = trackUvArray(new THREE.BufferGeometry(), () => [n++, 0]);
  assert.equal(g.attributes.uv.getX(0), 0);
  bt.setTerrainSizes({ stone: 32 }); assert.equal(g.attributes.uv.getX(0), 1);
  reset(); assert.equal(g.attributes.uv.getX(0), 2);
});

test("layout version counts changes and listeners hear them", () => {
  const seen = []; const off = bt.onTerrainRelayout((v) => seen.push(v));
  const v0 = bt.terrainLayoutVersion();
  bt.setTerrainSizes({ stone: 32 }); bt.setTerrainSizes({ stone: 32 }); reset();
  off(); bt.setTerrainSizes({ stone: 32 }); reset();
  assert.deepEqual(seen, [v0 + 1, v0 + 2], "a repeat of the same sizes is not a change");
});

test("Anaglyph: the item tint colour is not converted (RenderItem never reads EntityRenderer.anaglyphEnable), the texture is at upload", () => {
  const it = itemFromOriginal(31, 1), pass = () => itemPasses(it.id, it.damage), off = pass().tint; meshAnaglyph.on = true;
  try { assert.ok(off); assert.deepEqual(pass().tint, off); } finally { meshAnaglyph.on = false; }
});

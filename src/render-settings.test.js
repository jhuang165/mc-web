import test from "node:test";
import assert from "node:assert/strict";
import { SIZE, HEIGHT } from "./world.js";
import { LightVolume, smoothFace, partialFace, flatFace } from "./lighting.js";
import { migrateSettings } from "./settings.js";
import { optionText, denormalize } from "./menu-screens.js";
import {
  RENDER_DEFAULTS, normalizeRender, setRender, render, roundUpToPowerOfTwo, leavesOpaque, rainRadius, rainParticleStrength,
  shouldRenderClouds, shadowsEnabled, flatItemSprites, leafTextureName, translucentPasses, usePartialAo, mipLevel, mipChain, atlasMips,
} from "./render-settings.js";

test("defaults are the GameSettings defaults and invalid values are normalised", () => {
  assert.deepEqual(RENDER_DEFAULTS, { graphics: true, ao: 2, clouds: true, mipmapLevels: 4, anisotropic: 1 });
  assert.deepEqual(normalizeRender({}), RENDER_DEFAULTS);
  assert.deepEqual(normalizeRender({ ao: 9, mipmapLevels: -3, anisotropic: 5, graphics: "x" }), { graphics: true, ao: 2, clouds: true, mipmapLevels: 0, anisotropic: 8 });
  assert.equal(roundUpToPowerOfTwo(3), 4);
  assert.equal(roundUpToPowerOfTwo(16), 16);
});

test("migrateSettings keeps valid video settings and drops invalid ones", () => {
  const s = migrateSettings({ graphics: false, ao: 1, clouds: false, mipmapLevels: 2, anisotropic: 4 });
  assert.equal(s.graphics, false); assert.equal(s.ao, 1); assert.equal(s.clouds, false); assert.equal(s.mipmapLevels, 2); assert.equal(s.anisotropic, 4);
  const bad = migrateSettings({ graphics: "yes", ao: 7, mipmapLevels: "x" });
  assert.equal(bad.graphics, undefined); assert.equal(bad.ao, 2); assert.equal(bad.mipmapLevels, undefined);
});

test("fast graphics: opaque leaves, radius 5 rain, halved splash, flat items, one translucent pass, no shadows", () => {
  assert.equal(leavesOpaque(false), true); assert.equal(leavesOpaque(true), false);
  assert.equal(rainRadius(true), 10); assert.equal(rainRadius(false), 5);
  assert.equal(rainParticleStrength(1, false), 0.5); assert.equal(rainParticleStrength(1, true), 1);
  assert.equal(flatItemSprites(false), true); assert.equal(flatItemSprites(true), false);
  assert.equal(translucentPasses(true), 2); assert.equal(translucentPasses(false), 1);
  assert.equal(shadowsEnabled(false), false);
  assert.equal(leafTextureName("leaves_oak", false), "leaves_oak_opaque");
  assert.equal(leafTextureName("leaves_oak", true), "leaves_oak");
  assert.equal(leafTextureName("stone", false), "stone");
});

test("clouds need the option and a render distance of 4 chunks", () => {
  assert.equal(shouldRenderClouds(4, true), true);
  assert.equal(shouldRenderClouds(3, true), false);
  assert.equal(shouldRenderClouds(8, false), false);
});

test("setRender maps saved options onto the mesher state", () => {
  setRender({ graphics: false, ao: 0 });
  assert.equal(render.fancy, false); assert.equal(render.ao, 0);
  setRender({});
  assert.equal(render.fancy, true); assert.equal(render.ao, 2);
});

test("ambient occlusion modes pick flat, full or partial lighting", () => {
  assert.equal(usePartialAo(2, false), true);
  assert.equal(usePartialAo(2, true), false);
  assert.equal(usePartialAo(1, false), false);
  const data = new Uint8Array(SIZE * SIZE * HEIGHT);
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) for (let y = 0; y < 10; y++) data[(x * SIZE + z) * HEIGHT + y] = 3;
  const world = { data, get: (x, y, z) => (x < 0 || z < 0 || y < 0 || x >= SIZE || z >= SIZE || y >= HEIGHT ? 0 : data[(x * SIZE + z) * HEIGHT + y]),
    put(x, y, z, b) { data[(x * SIZE + z) * HEIGHT + y] = b; }, surface() { return 10; } };
  for (let x = 40; x < 44; x++) for (let z = 40; z < 44; z++) world.put(x, 12, z, 3);
  world.put(39, 10, 39, 3);
  const light = new LightVolume(world);
  const corners = [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]];
  const flat = flatFace(light, 40, 9, 40, 2, corners);
  assert.deepEqual(flat.ao, [1, 1, 1, 1]);
  assert.equal(new Set(flat.packed).size, 1, "flat lighting is one value per face");
  const full = smoothFace(light, 40, 9, 40, 2, corners);
  assert.ok(full.ao[0] < 1);
  const part = smoothFace(light, 40, 9, 40, 2, corners, true, true);
  assert.deepEqual(part.ao, partialFace(light, 40, 9, 40, 2, corners, true).ao);
  assert.equal(part.ao.length, 4);
});

test("mipmap levels average in gamma 2.2 and transparent texels are skipped", () => {
  const px = (r, g, b, a) => [r, g, b, a];
  const src = new Uint8ClampedArray([...px(0, 0, 0, 255), ...px(255, 255, 255, 255), ...px(0, 0, 0, 255), ...px(255, 255, 255, 255)]);
  const opaque = mipLevel(src, 2, 2, false);
  assert.equal(opaque.data[3], 255);
  assert.equal(opaque.data[0], Math.trunc(Math.pow(0.5, 1 / 2.2) * 255));
  const clear = new Uint8ClampedArray([...px(255, 255, 255, 20), ...px(0, 0, 0, 0), ...px(0, 0, 0, 0), ...px(0, 0, 0, 0)]);
  assert.equal(mipLevel(clear, 2, 2, true).data[3], 0, "alpha below 96 becomes 0");
  assert.equal(mipChain(new Uint8ClampedArray(16 * 16 * 4).fill(255), 16, 16, 4).length, 5);
});

test("atlas mip chains do not bleed between 16-pixel tiles", () => {
  const w = 32, h = 16, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(x < 16 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * w + x) * 4);
  const mips = atlasMips(data, w, h, 16, 4);
  assert.equal(mips.length, 5);
  const last = mips[4];
  assert.equal(last.width, 2);
  assert.deepEqual([...last.data.subarray(0, 4)], [255, 0, 0, 255]);
  assert.deepEqual([...last.data.subarray(4, 8)], [0, 0, 255, 255]);
  const none = atlasMips(data, w, h, 16, 0);
  assert.equal(none.length, 1);
  assert.equal(none[0].data, data, "level 0 stays pixel-exact");
});

test("video buttons show the new settings", () => {
  assert.equal(optionText("GRAPHICS", false), "Graphics: Fast");
  assert.equal(optionText("AMBIENT_OCCLUSION", 1), "Smooth Lighting: Minimum");
  assert.equal(optionText("MIPMAP_LEVELS", 0), "Mipmap Levels: OFF");
  assert.equal(optionText("ANISOTROPIC_FILTERING", 8), "Anisotropic Filtering: 8");
  assert.equal(denormalize("MIPMAP_LEVELS", 1), 4);
});

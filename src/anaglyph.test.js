import test from 'node:test';
import assert from 'node:assert/strict';
import { anaglyphRgba, anaglyphColor, installAnaglyphUpload } from './anaglyph.js';

test('anaglyphRgba matches TextureUtil.anaglyphColor per pixel (integer division, alpha kept)', () => {
  for (const argb of [0xff000000, 0xffffffff, 0x80ff0000, 0xff12ab9f, 0x7f804020]) {
    const d = new Uint8Array([argb >>> 16 & 255, argb >>> 8 & 255, argb & 255, argb >>> 24]);
    anaglyphRgba(d);
    const n = anaglyphColor(argb);
    assert.deepEqual([...d], [n >>> 16 & 255, n >>> 8 & 255, n & 255, n >>> 24]);
  }
});

test('upload hook converts typed-array uploads only while on, and never render-target allocations', () => {
  const calls = [];
  const gl = { RGBA: 6408, UNSIGNED_BYTE: 5121, texImage2D: (...a) => calls.push(['img', ...a]), texSubImage2D: (...a) => calls.push(['sub', ...a]) };
  const { state } = installAnaglyphUpload(gl);
  gl.texSubImage2D(1, 0, 0, 0, 1, 1, 6408, 5121, new Uint8Array([255, 0, 0, 255]), 0);
  assert.deepEqual([...calls.pop()[9]], [255, 0, 0, 255]);
  state.on = true;
  gl.texSubImage2D(1, 0, 0, 0, 1, 1, 6408, 5121, new Uint8Array([255, 0, 0, 255]));
  assert.deepEqual([...calls.pop()[9]], [76, 76, 76, 255]);
  gl.texImage2D(1, 0, 6408, 4, 4, 0, 6408, 5121, null);
  assert.equal(calls.pop()[9], null);
  assert.equal(installAnaglyphUpload(gl).state, state);
});

import { readFileSync } from 'node:fs';
import { meshAnaglyph, anaglyphMultiplier } from './anaglyph.js';
const colorsRef = JSON.parse(readFileSync(new URL('../public/research/anaglyph-colors-reference.json', import.meta.url)));

test('RenderBlocks colour multipliers convert like the native float expression, only while meshAnaglyph is on', () => {
  for (const { rgb, out } of colorsRef.multipliers) {
    assert.deepEqual(anaglyphMultiplier(rgb, true), out.map(Math.fround), rgb.toString(16));
    assert.deepEqual(anaglyphMultiplier(rgb, false), [rgb >> 16 & 255, rgb >> 8 & 255, rgb & 255].map((v) => Math.fround(v / 255)));
  }
  assert.equal(meshAnaglyph.on, false);
  assert.deepEqual(anaglyphMultiplier(0xFF0000), [1, 0, 0]);
  meshAnaglyph.on = true;
  try { assert.deepEqual(anaglyphMultiplier(0xFFFFFF), [1, 1, 1]); assert.ok(Math.abs(anaglyphMultiplier(0xFF0000)[1] - 0.3) < 1e-6); } finally { meshAnaglyph.on = false; }
});

test('sunrise fan: only the centre vertex converts, the rim keeps the raw rgb', async () => {
  const { anaglyphFog } = await import('./post-shaders.js');
  for (const { in: s, centre, rim } of colorsRef.sunrise) {
    assert.deepEqual(anaglyphFog(s), centre.map(Math.fround));
    assert.deepEqual(rim, s.slice(0, 3));
  }
});

test('the native reader inventory lists the 13 RenderBlocks sites', () => {
  assert.equal(Object.keys(colorsRef.readers['EntityRenderer.anaglyphEnable (blt.a, static)'].readers[0].methods).length, 13);
});

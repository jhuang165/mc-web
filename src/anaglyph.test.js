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

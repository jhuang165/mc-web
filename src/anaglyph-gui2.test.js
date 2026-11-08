import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installAnaglyphUpload, anaglyphRgba } from './anaglyph.js';
import { decodePng } from './png-codec.js';
import { bumpMediaGeneration } from './media-version.js';
import { guiAnaglyph, setGuiAnaglyph, requestGuiAnaglyph, commitGuiAnaglyph, wantsGuiAnaglyph, convertExact, rewriteGuiText, convertUrl } from './gui-anaglyph.js';
import { createAtlasUploader } from './atlas-upload.js';

const MEDIA = new URL('../public/media/1.7.10/', import.meta.url);
const realFetch = globalThis.fetch;
const stubFetch = () => { globalThis.fetch = async (url) => { const b = readFileSync(new URL(String(url).replace(/\?r=\d+$/, '').replace('/media/1.7.10/', ''), MEDIA)); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; }; };
const fakeGl = () => {
  const calls = [];
  return { RGBA: 6408, UNSIGNED_BYTE: 5121, calls, texImage2D: (...a) => calls.push(['tex', ...a]), texSubImage2D: (...a) => calls.push(['sub', ...a]) };
};

test('upload hook: an Image with known /media url uploads the exact converted pixels (no canvas), a flagged canvas passes through', async () => {
  stubFetch();
  try {
    bumpMediaGeneration();
    assert.equal(await convertExact('/media/1.7.10/gui/widgets.png'), true);
    const gl = fakeGl(), state = { on: true }, hook = installAnaglyphUpload(gl, state);
    const png = await decodePng(new Uint8Array(readFileSync(new URL('gui/widgets.png', MEDIA))));
    anaglyphRgba(png.data);
    const image = { width: png.width, height: png.height, currentSrc: 'http://localhost:5316/media/1.7.10/gui/widgets.png?r=4' };
    gl.texImage2D(3553, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    const [, , , , w, h, , , , data] = gl.calls.at(-1);
    assert.equal(hook.stats.exact, 1);
    assert.deepEqual([w, h], [png.width, png.height]);
    assert.deepEqual([...data], [...png.data], 'straight-alpha converted pixels, translucent ones included');
    const flagged = { width: 16, height: 16, __agDone: true };
    gl.texImage2D(3553, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, flagged);
    assert.equal(gl.calls.at(-1)[6], flagged, 'passed through untouched');
    assert.equal(hook.stats.passed, 1);
  } finally { globalThis.fetch = realFetch; }
});

test('atlas uploader: rects flagged converted bypass the upload hook, others are converted by it', () => {
  const gl = fakeGl(), state = { on: true };
  installAnaglyphUpload(gl, state);
  gl.pixelStorei = () => {}; gl.TEXTURE_2D = 3553; gl.UNPACK_FLIP_Y_WEBGL = 1; gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL = 2; gl.UNPACK_ALIGNMENT = 3;
  const tex = { image: { height: 32 }, flipY: true };
  const renderer = { getContext: () => gl, properties: { get: () => ({ __webglTexture: {} }) }, state: { bindTexture() {}, unbindTexture() {} } };
  const up = createAtlasUploader(renderer, {});
  up.queue(tex, 0, 0, 0, 1, 1, new Uint8Array([200, 100, 50, 255]), true);
  up.queue(tex, 0, 1, 0, 1, 1, new Uint8Array([200, 100, 50, 255]), false);
  up.flush();
  const subs = gl.calls.filter((c) => c[0] === 'sub');
  assert.deepEqual([...subs[0][9]], [200, 100, 50, 255], 'pre-converted data is not converted again');
  assert.deepEqual([...subs[1][9]], [(200 * 30 + 100 * 59 + 50 * 11) / 100 | 0, (200 * 30 + 100 * 70) / 100 | 0, (200 * 30 + 50 * 70) / 100 | 0, 255]);
  assert.equal(state.on, true, 'hook state restored');
});

test('toggle ahead: a request keeps the old GUI state until the commit; pending inline images are hidden, never raw', async () => {
  stubFetch();
  try {
    const gen = bumpMediaGeneration();
    setGuiAnaglyph(false);
    requestGuiAnaglyph(true);
    assert.equal(wantsGuiAnaglyph(), true);
    assert.equal(guiAnaglyph.on, false, 'old state stays until committed');
    commitGuiAnaglyph();
    assert.equal(guiAnaglyph.on, true);
    const css = "background:url('/media/1.7.10/gui/icons.png')";
    assert.match(rewriteGuiText(css, gen, true), /data:image\/gif/, 'pending path shows a transparent pixel');
    await convertUrl('/media/1.7.10/gui/icons.png');
    assert.match(rewriteGuiText(css, gen, true), /data:image\/png;base64,.*#mcag=/, 'ready path is converted');
    requestGuiAnaglyph(false);
    assert.equal(guiAnaglyph.on, true);
    commitGuiAnaglyph();
    assert.equal(guiAnaglyph.on, false);
  } finally { globalThis.fetch = realFetch; setGuiAnaglyph(false); }
});

test('convertGuiCanvas (profile skin preview) converts texture pixels in place only while the option is on', async () => {
  const { convertGuiCanvas } = await import('./gui-anaglyph.js');
  const make = () => { const image = { data: new Uint8ClampedArray([255, 0, 0, 255, 10, 200, 90, 128]) }; const g = { getImageData: () => image, putImageData: () => {} }; return { width: 2, height: 1, getContext: () => g, image }; };
  setGuiAnaglyph(false);
  const off = make(); convertGuiCanvas(off);
  assert.deepEqual([...off.image.data], [255, 0, 0, 255, 10, 200, 90, 128]);
  setGuiAnaglyph(true);
  try {
    const on = make(); convertGuiCanvas(on);
    assert.deepEqual([...on.image.data], [76, 76, 76, 255, (10 * 30 + 200 * 59 + 90 * 11) / 100 | 0, (10 * 30 + 200 * 70) / 100 | 0, (10 * 30 + 90 * 70) / 100 | 0, 128]);
  } finally { setGuiAnaglyph(false); }
});

test('tint order: convert(texture) x convert(multiplier) differs from convert(texture x multiplier) on a coloured texel', async () => {
  const { anaglyphMultiplier } = await import('./anaglyph.js');
  const texel = [200, 40, 120], mult = 0x91bd59, f = anaglyphMultiplier(mult, true), plain = [0x91 / 255, 0xbd / 255, 0x59 / 255];
  const conv = ([r, g, b]) => [(r * 30 + g * 59 + b * 11) / 100 | 0, (r * 30 + g * 70) / 100 | 0, (r * 30 + b * 70) / 100 | 0];
  const native = conv(texel).map((v, k) => Math.round(v * f[k])), old = conv(texel.map((v, k) => Math.round(v * plain[k])));
  assert.notDeepEqual(native, old, 'the order is observable for non-grey textures (grey vanilla tiles agree)');
  const grey = [148, 148, 148];
  assert.ok(conv(grey).map((v, k) => Math.round(v * f[k])).every((v, k) => Math.abs(v - conv(grey.map((x, j) => Math.round(x * plain[j])))[k]) <= 1));
});

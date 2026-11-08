import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodePng, encodePng } from './png-codec.js';
import { anaglyphRgba } from './anaglyph.js';
import { bumpMediaGeneration } from './media-version.js';
import { guiAnaglyph, setGuiAnaglyph, convertPngBytes, convertUrl, convertedUrl, rewriteGuiText, pathsIn, applyImg, rawImgSrc } from './gui-anaglyph.js';

const MEDIA = new URL('../public/media/1.7.10/', import.meta.url);
const reference = JSON.parse(readFileSync(new URL('../public/research/anaglyph-gui-reference.json', import.meta.url)));
const read = (name) => new Uint8Array(readFileSync(new URL(name, MEDIA)));
// SHA-1 of the big-endian ARGB int array, the form tools/probes/Anaglyph3Probe.java hashes.
const argbHash = ({ width, height, data }) => {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) { out[i * 4] = data[i * 4 + 3]; out[i * 4 + 1] = data[i * 4]; out[i * 4 + 2] = data[i * 4 + 1]; out[i * 4 + 3] = data[i * 4 + 2]; }
  return createHash('sha1').update(out).digest('hex');
};

test('GUI conversion equals the unchanged client TextureUtil.anaglyphColor on every shipped GUI texture (native SHA-1 of the ARGB array)', async () => {
  let checked = 0, translucent = 0;
  const missing = [];
  for (const t of reference.textures) {
    if (!existsSync(new URL(t.name, MEDIA))) { missing.push(t.name); continue; }
    const png = await decodePng(read(t.name));
    assert.ok(png, `${t.name} decodes`);
    assert.equal(argbHash(png), t.raw, `${t.name}: shipped pixels equal the jar's`);
    const converted = await decodePng(await convertPngBytes(read(t.name)));
    assert.equal(argbHash(converted), t.conv, `${t.name}: converted pixels equal native`);
    checked++; translucent += t.translucent ? 1 : 0;
  }
  assert.ok(checked >= 250, `checked ${checked}, missing ${missing.join(',')}`);
  assert.ok(translucent >= 10, 'translucent textures (widgets.png, icons.png) are covered');
});

test('png codec: encode then decode is lossless, odd inputs are refused', async () => {
  const data = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) & 255);
  const back = await decodePng(await encodePng(3, 2, data));
  assert.deepEqual([back.width, back.height, [...back.data]], [3, 2, [...data]]);
  assert.equal(await decodePng(new Uint8Array([1, 2, 3])), null);
});

const realFetch = globalThis.fetch;
test('converted urls carry the source path, are cached per source, and restore when the option is turned off', async () => {
  globalThis.fetch = async (url) => {
    const path = String(url).replace(/\?r=\d+$/, '').replace('/media/1.7.10/', '');
    return existsSync(new URL(path, MEDIA)) ? { ok: true, arrayBuffer: async () => { const b = readFileSync(new URL(path, MEDIA)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } } : { ok: false };
  };
  try {
    const gen = bumpMediaGeneration();
    const css = `background:url('/media/1.7.10/gui/icons.png') 0 0,url("http://h:1/media/1.7.10/gui/widgets.png?r=1"),url(/other/x.png)`;
    assert.equal(rewriteGuiText(css, 0), `background:url('/media/1.7.10/gui/icons.png') 0 0,url("http://h:1/media/1.7.10/gui/widgets.png"),url(/other/x.png)`);
    setGuiAnaglyph(true);
    assert.equal(guiAnaglyph.on, true);
    assert.deepEqual([...pathsIn(css)].sort(), ['/media/1.7.10/gui/icons.png', '/media/1.7.10/gui/widgets.png']);
    assert.equal(convertedUrl('/media/1.7.10/gui/icons.png'), null, 'not ready yet: the original stays');
    assert.ok(rewriteGuiText(css, gen).includes('/media/1.7.10/gui/icons.png?r='));
    const url = await convertUrl('/media/1.7.10/gui/icons.png');
    assert.equal(await convertUrl('/media/1.7.10/gui/icons.png?r=9'), url, 'one conversion per source');
    assert.match(url, /^data:image\/png;base64,[A-Za-z0-9+/=]+#mcag=%2Fmedia%2F1\.7\.10%2Fgui%2Ficons\.png$/);
    const pixels = await decodePng(new Uint8Array(Buffer.from(url.slice(22, url.indexOf('#')), 'base64')));
    const expected = await decodePng(read('gui/icons.png'));
    anaglyphRgba(expected.data);
    assert.deepEqual([...pixels.data], [...expected.data]);
    const on = rewriteGuiText(css, gen);
    assert.ok(on.includes(url) && on.includes('url(/other/x.png)') && !on.includes('/media/1.7.10/gui/icons.png'));
    assert.equal(rewriteGuiText(on, gen), on, 'rewriting converted text again changes nothing');
    setGuiAnaglyph(false);
    assert.equal(rewriteGuiText(on, gen), `background:url('/media/1.7.10/gui/icons.png?r=${gen}') 0 0,url("http://h:1/media/1.7.10/gui/widgets.png?r=${gen}"),url(/other/x.png)`);
  } finally { globalThis.fetch = realFetch; setGuiAnaglyph(false); }
});

test('<img> sources: pending shows nothing, converted replaces, raw source stays readable, off restores, new src is adopted', async () => {
  globalThis.fetch = async (url) => { const b = readFileSync(new URL(String(url).replace(/\?r=\d+$/, '').replace('/media/1.7.10/', ''), MEDIA)); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
  const img = (src) => { const attrs = { src }; return { dataset: {}, getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; } }; };
  try {
    const gen = bumpMediaGeneration();
    setGuiAnaglyph(true);
    const a = img('/media/1.7.10/items/apple.png');
    applyImg(a, gen);
    assert.match(a.getAttribute('src'), /^data:image\/gif/);
    assert.equal(rawImgSrc(a), '/media/1.7.10/items/apple.png');
    await convertUrl('/media/1.7.10/items/apple.png');
    await new Promise((r) => setTimeout(r, 0));
    assert.match(a.getAttribute('src'), /^data:image\/png;base64,.*#mcag=/);
    assert.equal(rawImgSrc(a), '/media/1.7.10/items/apple.png');
    applyImg(a, gen); // own write: unchanged
    assert.equal(a.dataset.rawSrc, '/media/1.7.10/items/apple.png');
    a.setAttribute('src', '/media/1.7.10/items/bread.png'); // other code swaps the icon
    applyImg(a, gen);
    assert.equal(rawImgSrc(a), '/media/1.7.10/items/bread.png');
    const data = 'data:image/png;base64,' + Buffer.from(await encodePng(1, 1, new Uint8Array([255, 0, 0, 255]))).toString('base64');
    const d = img(data);
    applyImg(d, gen);
    await convertUrl(data); await new Promise((r) => setTimeout(r, 0));
    const done = await decodePng(new Uint8Array(Buffer.from(d.getAttribute('src').slice(22, d.getAttribute('src').indexOf('#')), 'base64')));
    assert.deepEqual([...done.data], [76, 76, 76, 255]); // (30*255)/100 on every channel
    assert.equal(rawImgSrc(d), data);
    setGuiAnaglyph(false);
    const gen2 = bumpMediaGeneration();
    applyImg(a, gen2); applyImg(d, gen2);
    assert.equal(a.getAttribute('src'), `/media/1.7.10/items/bread.png?r=${gen2}`);
    assert.equal(d.getAttribute('src'), data);
    assert.equal(a.dataset.rawSrc, undefined);
  } finally { globalThis.fetch = realFetch; setGuiAnaglyph(false); }
});

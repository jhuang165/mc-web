// Batch 73 skins73: the skin cleanup replays the executed 1.7.10 ImageBufferDownload.parseUserSkin (public/research/skin-parse-reference.json),
// the offline skin store, and that nothing in the port draws an Alex model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { userSkinPixels, normalizeSkinPixels, acceptedSkinSize } from './skin.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/skin-parse-reference.json', import.meta.url), 'utf8'));
const argb = (b64) => { const b = Buffer.from(b64, 'base64'), out = []; for (let i = 0; i < b.length; i += 4) out.push(b.readUInt32BE(i)); return out; };
const toRgba = (ints) => { const o = new Uint8ClampedArray(ints.length * 4); ints.forEach((v, i) => { o[i * 4] = v >>> 16 & 255; o[i * 4 + 1] = v >>> 8 & 255; o[i * 4 + 2] = v & 255; o[i * 4 + 3] = v >>> 24; }); return o; };
const toArgb = (rgba) => { const o = []; for (let i = 0; i < rgba.length; i += 4) o.push(((rgba[i + 3] << 24) | (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]) >>> 0); return o; };

test('reference is the unchanged ImageBufferDownload with 14 cases', () => {
  assert.equal(ref.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.equal(ref.records.length, 14);
  assert.deepEqual(ref.records.filter(r => r.output).every(r => r.outWidth === 64 && r.outHeight === 32 && r.outType === 2), true);
  assert.equal(ref.records.find(r => r.case === 'null').output, null);
});

for (const r of ref.records.filter(r => r.output)) {
  test(`userSkinPixels equals native parseUserSkin: ${r.case}`, () => {
    const got = toArgb(userSkinPixels(toRgba(argb(r.input)), r.width, r.height));
    assert.deepEqual(got, argb(r.output));
  });
}

test('the sizes the browser path accepts replay through normalizeSkinPixels', () => {
  for (const r of ref.records.filter(r => r.output && r.width === 64 && acceptedSkinSize(r.width, r.height))) {
    assert.deepEqual(toArgb(normalizeSkinPixels(toRgba(argb(r.input)), r.height)), argb(r.output), r.case);
  }
  assert.throws(() => normalizeSkinPixels(new Uint8ClampedArray(32 * 32 * 4), 32));
});

test('native facts the port relies on (executed)', () => {
  const c = (n) => ref.records.find(r => r.case === n), out = (n) => argb(c(n).output), at = (n, x, y) => out(n)[y * 64 + x] >>> 24;
  assert.equal(at('hat-one-127', 40, 5), 127);       // a pixel below 128 keeps the whole hat area
  assert.equal(at('hat-one-128', 40, 5), 0);         // 128 counts as opaque: the hat is cleared
  assert.equal(at('transparent', 5, 5), 255);        // head forced opaque
  assert.equal(at('transparent', 40, 5), 0);         // hat stays clear
  assert.equal(at('head-transparent', 5, 5), 255);
  assert.equal(at('transparent', 10, 20), 255);      // body forced opaque
});

// --- store, apply and skull heads ---
import { deflateSync } from 'node:zlib';
import { skinPngError, MAX_SKIN_BYTES } from './skin.js';
import { SpSkinStore, applyLocalSkin } from './sp-skin.js';
import { SkinBook } from './skull-skins.js';

function png(width, height) {
  const t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const o = Buffer.alloc(12 + data.length); o.writeUInt32BE(data.length, 0); o.write(type, 4, 'ascii'); data.copy(o, 8); o.writeUInt32BE(crc(o.subarray(4, 8 + data.length)), 8 + data.length); return o; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height, 0x7f); for (let y = 0; y < height; y++) raw[y * (width * 4 + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };

test('skinPngError: stored skins are 64 x 32 PNGs of at most 16 KB', () => {
  assert.equal(skinPngError(png(64, 32)), null);
  assert.equal(skinPngError(png(64, 64)).status, 400);
  assert.equal(skinPngError(png(32, 32)).status, 400);
  assert.equal(skinPngError(Buffer.alloc(MAX_SKIN_BYTES + 1)).status, 413);
  assert.equal(skinPngError(null).status, 413);
});

test('SpSkinStore: set, reload, clear, bad stored value ignored', () => {
  const storage = memory(), bytes = new Uint8Array(png(64, 32)), a = new SpSkinStore(storage);
  assert.equal(a.get(), null); assert.equal(a.tag, null);
  assert.throws(() => a.set(new Uint8Array(png(64, 64))), /64 × 32/);
  assert.equal(storage.m.size, 0);
  a.set(bytes);
  assert.deepEqual([...new SpSkinStore(storage).get()], [...bytes]);
  assert.equal(a.tag, 'local:1');
  storage.setItem('blockworld.skin', 'AAAA'); assert.equal(new SpSkinStore(storage).get(), null);
  a.clear(); assert.equal(a.get(), null); assert.equal(a.tag, null);
  assert.throws(() => new SpSkinStore({ getItem: () => null, setItem() { throw new Error('quota'); } }).set(bytes), /could not store/);
});

const fakeRenderer = () => ({ skinHash: null, hasSkin: false, base: { uniforms: { map: { value: 'steve' } } } });

test('applyLocalSkin: Steve without a skin, the skin once it loads, Steve again after clearing', async () => {
  const store = new SpSkinStore(memory()), r = fakeRenderer(), load = async () => 'custom';
  applyLocalSkin(r, store, load);
  assert.equal(r.base.uniforms.map.value, 'steve'); assert.equal(r.hasSkin, false);
  store.set(new Uint8Array(png(64, 32)));
  applyLocalSkin(r, store, load); await new Promise(res => setImmediate(res));
  assert.equal(r.base.uniforms.map.value, 'custom'); assert.equal(r.hasSkin, true);
  store.clear(); applyLocalSkin(r, store, load);
  assert.equal(r.base.uniforms.map.value, 'steve'); assert.equal(r.hasSkin, false);
});

test('applyLocalSkin: a late load for a replaced skin is dropped', async () => {
  const store = new SpSkinStore(memory()), r = fakeRenderer(); let release;
  store.set(new Uint8Array(png(64, 32)));
  applyLocalSkin(r, store, () => new Promise(res => { release = () => res('old'); }));
  store.clear(); applyLocalSkin(r, store, async () => 'new');
  release(); await new Promise(res => setImmediate(res));
  assert.equal(r.base.uniforms.map.value, 'steve');
});

test('skull heads named after the local player resolve through the book as main.js registers it', () => {
  const r = fakeRenderer(); r.name = 'Player';
  const book = new SkinBook();
  book.add({ skinOf: lower => (r.hasSkin && r.name?.toLowerCase() === lower ? r.base.uniforms.map.value : null) });
  assert.equal(book.lookup('Player'), null); // Steve until a skin is applied
  r.hasSkin = true; r.base.uniforms.map.value = 'custom';
  assert.equal(book.lookup({ name: 'PLAYER' }), 'custom');
  assert.equal(book.lookup('Other'), null);
});

test('1.7.10 has one player model (Steve): no Alex or slim model anywhere in the port', () => {
  const hits = [];
  const walk = dir => { for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = dir + f.name; if (f.isDirectory()) { walk(p + '/'); continue; }
    if (!/\.js$/.test(f.name) || /\.test\.js$/.test(f.name)) continue;
    const text = readFileSync(p, 'utf8');
    if (/\b(alex|slim(?:Arms|Model|Skin)?|isSlim|armWidth)\b/i.test(text.replace(/\bslim(e|es)\b/gi, ''))) hits.push(p);
  } };
  walk(new URL('./', import.meta.url).pathname);
  assert.deepEqual(hits, []);
});

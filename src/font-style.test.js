import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFontWidths, setGlyphSizes, font } from './font-renderer.js';
import { drawStringPrims } from './font-quads.js';
import { bidiReorder } from './bidi.js';
import { JavaRandom } from './java-random.js';
import { readPng } from '../tools/png-rgba.mjs';

const ref = JSON.parse(readFileSync(new URL('../public/research/font-style-reference.json', import.meta.url), 'utf8'));
const media = (p) => readFileSync(new URL(`../public/media/1.7.10/font/${p}`, import.meta.url));
const png = readPng(media('ascii.png'));
const widths = readFontWidths(png.data, png.width, png.height);
const glyph = media('glyph_sizes.bin');
setGlyphSizes(glyph);
const sizes = font.glyphSizes;
const tex = (t) => (t.includes('ascii') ? 'ascii' : /unicode_page_(..)/.test(t) ? 'page' + /unicode_page_(..)/.exec(t)[1] : t);
const norm = (p) => JSON.stringify([p.k, p.k === 'g' ? tex(p.tex) : null, p.c.map(Math.fround), p.v.map((v) => v.map(Math.fround))]);
const hexToStr = (h) => h.split(' ').filter(Boolean).map((x) => String.fromCharCode(parseInt(x, 16))).join('');

for (const { unicode, rows } of ref.draw) {
  test(`drawString primitives replay the native FontRenderer (unicode flag ${unicode}, ${rows.length} rows)`, () => {
    const state = { unicode, widths, glyphSizes: sizes };
    let checked = 0;
    for (const r of rows) {
      if (r.s.includes('§k')) continue; // obfuscation picks random glyphs
      const got = drawStringPrims(r.s, r.x, r.y, r.color, r.shadow, state, () => 0, null);
      const exp = r.prims.map(norm);
      assert.deepEqual(got.prims.map((p) => norm({ ...p, tex: p.k === 'g' ? p.tex : '' })), exp, `${JSON.stringify(r.s)} shadow=${r.shadow}`);
      assert.equal(got.x, r.ret, `${JSON.stringify(r.s)} return value`);
      checked++;
    }
    assert.ok(checked > 60);
  });
}

test('underline, strikethrough and italic are drawn on unicode glyph pages like on ascii.png', () => {
  const state = { unicode: true, widths, glyphSizes: sizes };
  const { prims } = drawStringPrims('§n§m§oあ', 10, 20, 0xffffff, false, state, () => 0, null);
  const bars = prims.filter((p) => p.k === 'b'), glyphs = prims.filter((p) => p.k === 'g');
  assert.equal(bars.length, 2);
  assert.equal(glyphs.length, 1);
  const [strike, under] = bars;
  assert.equal(strike.v[0][1], 24); assert.equal(strike.v[2][1], 23); // y + 3 .. y + 4
  assert.equal(under.v[0][0], 9); assert.equal(under.v[0][1], 29); assert.equal(under.v[2][1], 28); // starts one pixel left, y + 8 .. y + 9
  const plain = drawStringPrims('あ', 10, 20, 0xffffff, false, state, () => 0, null).prims[0].v;
  // the quad's two top corners (smaller y) move +1 and the two bottom corners -1, as in renderUnicodeChar
  glyphs[0].v.forEach((v, i) => assert.equal(v[0] - plain[i][0], v[1] === Math.min(...plain.map((q) => q[1])) ? 1 : -1));
});

test('bidiReorder replays ICU4J ArabicShaping + Bidi of the unchanged FontRenderer', () => {
  assert.ok(ref.bidi.length > 400);
  let rtl = 0;
  for (const [input, output] of ref.bidi) {
    const s = hexToStr(input);
    assert.equal([...bidiReorder(s)].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' '), output, input);
    if (/[֐-ۿ]/.test(s)) rtl++;
  }
  assert.ok(rtl > 100);
});

test('bidiReorder: shaping, mirroring and run reversal on known strings', () => {
  assert.equal(bidiReorder('abc'), 'abc');
  assert.equal(bidiReorder('אבג'), 'גבא');
  assert.equal(bidiReorder('(א)'), '(א)'.replace(/./g, (c) => c)); // brackets mirror and the order flips: (א) stays (א) visually
  assert.equal(bidiReorder('لا'), 'ﻻ'); // lam + alef ligature
  assert.equal(bidiReorder('ب'), 'ﺏ'); // isolated beh... at paragraph level RTL, joined forms only next to letters
});

test('§k replays the native random stream: 224 seeded rows, shadow and normal pass on one stream, both unicode flags', () => {
  assert.ok(ref.random.length >= 200);
  let obfuscated = 0;
  for (const r of ref.random) {
    const state = { unicode: r.unicode, widths, glyphSizes: sizes };
    const rnd = new JavaRandom(r.seed);
    const got = drawStringPrims(r.s, r.x, r.y, r.color, r.shadow, state, (n) => rnd.nextInt(n), null);
    assert.deepEqual(got.prims.map((p) => norm({ ...p, tex: p.k === 'g' ? p.tex : '' })), r.prims.map(norm), `${JSON.stringify(r.s)} seed ${r.seed} shadow=${r.shadow} unicode=${r.unicode}`);
    assert.equal(got.x, r.ret);
    assert.equal(rnd.nextInt(256), r.next, `stream position after ${JSON.stringify(r.s)}`);
    obfuscated++;
  }
  assert.equal(obfuscated, ref.random.length);
});

test('§k does nothing visible with the unicode flag but still draws random numbers', () => {
  const state = { unicode: true, widths, glyphSizes: sizes };
  let n = 0;
  const a = drawStringPrims('§kabc', 0, 0, 0xffffff, false, state, () => { n++; return 0; }, null);
  const b = drawStringPrims('abc', 0, 0, 0xffffff, false, state, () => 0, null);
  assert.deepEqual(a.prims.map(norm), b.prims.map(norm));
  assert.ok(n >= 3);
});

test('the colour table follows GameSettings.anaglyph (bbu constructor): conversion before the shadow division', async () => {
  const { colorCodeTable } = await import('./font-renderer.js');
  const plain = colorCodeTable(false), ana = colorCodeTable(true);
  assert.equal(plain[6], 0xffaa00); assert.equal(plain[22], 0x2a2a00); // the +85 red applies to entry 6 only: the gold shadow is (170,170,0) / 4, not (255,170,0) / 4
  // entry 12 (255,85,85): R' = (30*255+59*85+11*85)/100 = 136, G' = (30*255+70*85)/100 = 136, B' = 136
  assert.equal(ana[12], 0x888888);
  assert.equal(ana[28], 0x222222); // the shadow entry is the converted colour over 4
  for (const i of [0, 15]) assert.ok(ana[i] >= 0);
});

test('the 32 entry colour table equals the unchanged constructor for anaglyph off and on', async () => {
  const { colorCodeTable } = await import('./font-renderer.js');
  assert.equal(ref.colors.length, 64);
  for (const r of ref.colors) {
    const c = colorCodeTable(r.anaglyph)[r.code + (r.shadow ? 16 : 0)];
    // the plain call has no shadow pass; the shadow call's first quad is the shadow colour
    assert.deepEqual(r.c.slice(0, 3).map(Math.fround), [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => Math.fround(v / 255)), JSON.stringify(r));
  }
});

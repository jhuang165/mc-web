import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { galacticGlyph, galacticLayout, galacticWidth, wrapGalactic, ENCHANT_COLORS } from './enchanting-glyphs.js';
import { ENCHANT_NAME_WORDS } from './enchanting-book.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/enchanting-book-reference.json', import.meta.url)));

test('every letter of the word list has a stable, non-empty glyph', () => {
  const letters = new Set(ENCHANT_NAME_WORDS.join(''));
  for (const ch of letters) {
    const g = galacticGlyph(ch);
    assert.equal(g, galacticGlyph(ch));
    assert.equal(g.rows.length, 8);
    assert.ok(g.rows.join('').includes('#'), ch);
    assert.ok(g.advance >= 2 && g.advance <= 7, `${ch} advance ${g.advance}`);
  }
  assert.equal(galacticGlyph(' ').advance, 4);
});

test('the probed names lay out in wrapped lines of at most 104 pixels', () => {
  for (const r of ref.names) for (const name of r.names) {
    const lines = wrapGalactic(name);
    assert.equal(lines.join(' '), name);
    for (const line of lines) if (line.includes(' ')) assert.ok(galacticWidth(line) <= 104, line);
    const layout = galacticLayout(name);
    assert.equal(layout.height, lines.length * 9);
    assert.ok(layout.pixels.length > 10);
  }
});

test('GuiEnchantment colours', () => {
  assert.deepEqual(ENCHANT_COLORS, { normal: 0x685e4a, hover: 0xffff80, disabled: 0x342f25, level: 0x80ff20, levelDisabled: 0x407f10 });
});

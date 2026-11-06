// The "standard galactic" text of GuiEnchantment's option buttons. The original draws the words of EnchantmentNameParts
// with textures/font/ascii_sga.png, a Mojang asset this repo does not copy. These glyphs are original: each lowercase
// letter is a few strokes between nodes of a 5 x 7 lattice, chosen by a fixed per-letter generator, so the text is
// unreadable, stable between frames and coloured like the original (draw it as a mask, tint it with the button colour).
// Layout follows FontRenderer: 8 pixel cells, advance = rightmost lit column + 2, a space is 4 wide, lines 9 apart,
// FontRenderer.listFormattedStringToWidth wrapping at 104 pixels. The real glyph widths of ascii_sga.png are not
// reproduced, so line breaks can differ from the original on long names.

export const GLYPH_HEIGHT = 8, LINE_HEIGHT = 9, SPACE_WIDTH = 4, BUTTON_TEXT_WIDTH = 104;
// GuiEnchantment colours: normal 6839882, hover 16777088, disabled (normal & 0xFEFEFE) >> 1, level 8453920 / 4226832.
export const ENCHANT_COLORS = Object.freeze({ normal: 6839882, hover: 16777088, disabled: (6839882 & 0xfefefe) >> 1, level: 8453920, levelDisabled: 4226832 });

const NODES = [[0, 0], [2, 0], [4, 0], [0, 3], [2, 3], [4, 3], [0, 6], [2, 6], [4, 6]];
// mulberry32 over the letter's code point.
function stream(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function line(set, [x0, y0], [x1, y1]) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) set.add(`${Math.round(x0 + ((x1 - x0) * i) / (steps || 1))},${Math.round(y0 + ((y1 - y0) * i) / (steps || 1))}`);
}
const cache = new Map();
/** {rows: 8 strings of '#'/'.' (5 wide, y down), advance} for one character; null for a space or an unmapped code. */
export function galacticGlyph(ch) {
  if (ch === ' ') return { rows: null, advance: SPACE_WIDTH };
  if (cache.has(ch)) return cache.get(ch);
  const rand = stream(ch.codePointAt(0)), lit = new Set();
  let at = NODES[Math.floor(rand() * 9)];
  const strokes = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < strokes; i++) {
    let next;
    do next = NODES[Math.floor(rand() * 9)]; while (next === at);
    line(lit, at, next);
    at = rand() < 0.5 ? next : NODES[Math.floor(rand() * 9)];
  }
  if (rand() < 0.5) lit.add(`${Math.floor(rand() * 5)},${Math.floor(rand() * 7)}`);
  let right = 0;
  const rows = [];
  for (let y = 0; y < GLYPH_HEIGHT; y++) {
    let row = '';
    for (let x = 0; x < 5; x++) { const on = y < 7 && lit.has(`${x},${y}`); row += on ? '#' : '.'; if (on) right = Math.max(right, x); }
    rows.push(row);
  }
  const glyph = { rows, advance: right + 2 };
  cache.set(ch, glyph);
  return glyph;
}

export const galacticWidth = (text) => [...text].reduce((w, ch) => w + galacticGlyph(ch).advance, 0);

// FontRenderer.sizeStringToWidth and wrapFormattedStringToWidth (without formatting codes).
function sizeToWidth(text, wrap) {
  let width = 0, i = 0, space = -1;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') { i++; space = i; break; }
    if (ch === ' ') space = i;
    width += galacticGlyph(ch).advance;
    if (width > wrap) break;
  }
  return i !== text.length && space !== -1 && space < i ? space : i;
}
export function wrapGalactic(text, wrap = BUTTON_TEXT_WIDTH) {
  const lines = [];
  while (true) {
    const i = sizeToWidth(text, wrap);
    if (text.length <= i) { lines.push(text); return lines; }
    lines.push(text.slice(0, i));
    text = text.slice(i + (text[i] === ' ' || text[i] === '\n' ? 1 : 0));
  }
}

/** Lit pixels of the wrapped text as [{x, y}] (font pixels from the text origin) and the box they need. */
export function galacticLayout(text, wrap = BUTTON_TEXT_WIDTH) {
  const pixels = [], lines = wrapGalactic(text, wrap);
  lines.forEach((content, row) => {
    let x = 0;
    for (const ch of content) {
      const glyph = galacticGlyph(ch);
      glyph.rows?.forEach((r, y) => { for (let c = 0; c < r.length; c++) if (r[c] === '#') pixels.push({ x: x + c, y: row * LINE_HEIGHT + y }); });
      x += glyph.advance;
    }
  });
  return { lines, pixels, width: wrap, height: Math.max(1, lines.length) * LINE_HEIGHT };
}

/** The layout as a PNG data URL (white pixels, transparent elsewhere) for a CSS mask; needs a DOM. */
export function galacticMaskUrl(text, wrap = BUTTON_TEXT_WIDTH) {
  const layout = galacticLayout(text, wrap), canvas = document.createElement('canvas');
  canvas.width = layout.width; canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  for (const { x, y } of layout.pixels) ctx.fillRect(x, y, 1, 1);
  return { url: canvas.toDataURL('image/png'), width: layout.width, height: layout.height };
}

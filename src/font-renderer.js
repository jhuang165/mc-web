// FontRenderer (bbu) of Minecraft Java 1.7.10: character widths, the unicode flag and the glyph pages. Everything here is
// read from the 1.7.10 bytecode and replayed against the unchanged class by tools/verify-font.mjs (public/research/
// languages-reference.json, src/languages.test.js).
//
//   getCharWidth(c): '§' is -1, ' ' is 4. A character in the 256 entry table (font-table.js) is drawn from ascii.png and
//     has width charWidth[tableIndex] unless the unicode flag is set. Otherwise glyph_sizes.bin decides: a zero byte means no
//     glyph (width 0); else start = byte >>> 4, end = byte & 15 (the byte is signed, so a byte of 0x80 or more gives a huge
//     start), end > 7 reads as start 0 / end 15, and the width is (end + 1 - start) / 2 + 1 (integer division).
//   readFontTexture: charWidth[i] for the 256 ascii.png cells = (int)(0.5 + (rightmostOpaqueColumn + 1) * 8 / cellWidth) + 1,
//     a blank cell has width 0 + 1 = 1 apart from the space (4). A resource pack's ascii.png (any square multiple of 16) is read
//     the same way, which is why a pack with a larger font still lays out like 8x8 text.
//   getStringWidth: width sums with bold (§l) adding 1 per visible glyph until §r; '§' plus a character is skipped (width 0).
//   unicode flag: GuiLanguage sets it to `Locale.isUnicode() || gameSettings.forceUnicodeFont` (lang.js).
//   renderUnicodeChar: a 16x16 cell of unicode_page_XX.png (XX = c >> 8) drawn at half size from start to end + 1 - 0.02
//     glyph pixels; the pen advances (end + 1 - start) / 2 + 1 (a float, so the text can sit on half units).
import { CHAR_TABLE } from "./font-table.js";
import { DEFAULT_CHAR_WIDTHS } from "./font-widths.js";
import { bidiReorder } from "./bidi.js";

export { CHAR_TABLE };

/** Port of FontRenderer.readFontTexture over RGBA bytes: returns the 256 character widths. */
export function readFontWidths(rgba, width, height) {
  const cellW = Math.trunc(width / 16), cellH = Math.trunc(height / 16), f = Math.fround(8 / cellW), out = new Array(256).fill(0);
  for (let i = 0; i < 256; i++) {
    const col = i % 16, row = Math.trunc(i / 16);
    if (i === 32) out[i] = 4;
    let x = cellW - 1;
    for (; x >= 0; x--) {
      const px = col * cellW + x;
      let empty = true;
      for (let y = 0; y < cellH && empty; y++) if (rgba[((row * cellW + y) * width + px) * 4 + 3] !== 0) empty = false;
      if (!empty) break;
    }
    x++;
    out[i] = Math.trunc(Math.fround(0.5 + Math.fround(x * f))) + 1;
  }
  return out;
}

// The font state: the ascii.png widths, glyph_sizes.bin (an Int8Array of 65536 once loaded) and the unicode flag.
export const font = { unicode: false, bidi: false, anaglyph: false, colorCode: null, bidiReorder, widths: DEFAULT_CHAR_WIDTHS, glyphSizes: null, version: 0 };

/**
 * The FontRenderer colour table (colorCode[32], bbu constructor, javap): entry i has intensity 85 * bit 3 added to 170 * bits 2, 1, 0
 * (red, green, blue), +85 red for entry 6 (gold); with GameSettings.anaglyph (bbj.e) each entry becomes
 * ((30r + 59g + 11b) / 100, (30r + 70g) / 100, (30r + 70b) / 100) in integer arithmetic; entries 16-31 (the shadow colours) are then divided
 * by 4 per channel, so a shadow is the anaglyph colour over 4, not the anaglyph of the shadow colour. Only the constructor reads the
 * flag (onResourceManagerReload reads the textures only): toggling Anaglyph later leaves the § colours as they were until a restart.
 */
export function colorCodeTable(anaglyph = false) {
  const t = [];
  for (let i = 0; i < 32; i++) {
    const j = ((i >> 3) & 1) * 85;
    let r = ((i >> 2) & 1) * 170 + j, g = ((i >> 1) & 1) * 170 + j, b = (i & 1) * 170 + j;
    if (i === 6) r += 85;
    if (anaglyph) { const r2 = Math.trunc((r * 30 + g * 59 + b * 11) / 100), g2 = Math.trunc((r * 30 + g * 70) / 100), b2 = Math.trunc((r * 30 + b * 70) / 100); r = r2; g = g2; b = b2; }
    if (i >= 16) { r = Math.trunc(r / 4); g = Math.trunc(g / 4); b = Math.trunc(b / 4); }
    t.push(((r & 255) << 16) | ((g & 255) << 8) | (b & 255));
  }
  return t;
}
font.colorCode = colorCodeTable(false);
/** Fixes the § colour table for the session (FontRenderer construction reads GameSettings.anaglyph once, at startup). */
export function setFontAnaglyph(on) { on = !!on; if (font.anaglyph !== on) { font.anaglyph = on; font.colorCode = colorCodeTable(on); changed(); } }
/** The colour (0xRRGGBB) of a § code index 0-15; `shadow` selects the shadow table entry (index + 16). */
export const colorOf = (index, shadow = false, state = font) => (state.colorCode ?? font.colorCode)[index + (shadow ? 16 : 0)];

/**
 * The §k pick of renderStringAtPos for a character drawn from ascii.png cell `index`: fontRandom.nextInt(256) is drawn until that
 * cell has the same width, so the candidates are all 256 cells (accented letters, box drawing and the unused cells included), not
 * just the printable ASCII ones. `nextInt(n)` is java.util.Random.nextInt (one draw per attempt, the shadow and normal passes share the stream).
 */
export function randomGlyphIndex(index, nextInt, widths = font.widths) {
  let j;
  do j = nextInt(256); while (widths[index] !== widths[j]);
  return j;
}
const listeners = new Set();
export const onFontChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = () => { font.version++; for (const fn of listeners) fn(); };
export function setUnicodeFlag(on) { on = !!on; if (font.unicode !== on) { font.unicode = on; changed(); } }
/** FontRenderer.setBidiFlag: set when the language is bidirectional (ar_SA, he_IL); drawString then reorders every string (bidi.js). */
export function setBidiFlag(on) { on = !!on; if (font.bidi !== on) { font.bidi = on; changed(); } }
export function setGlyphSizes(bytes) { font.glyphSizes = bytes ? new Int8Array(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, 65536) : null; changed(); }
export function setCharWidths(widths) { font.widths = widths ?? DEFAULT_CHAR_WIDTHS; changed(); }

const tableIndex = (c) => (c > 0 ? CHAR_TABLE.indexOf(String.fromCharCode(c)) : -1);
// Bytes of glyph_sizes.bin before it loads: the unicode page glyphs count as absent (width 0) rather than guessing.
const glyphByte = (c, sizes = font.glyphSizes) => (sizes ? sizes[c] : 0);
/** FontRenderer.getCharWidth(char c) with the given state (default: the live font). */
export function getCharWidth(c, state = font) {
  if (typeof c === "string") c = c.charCodeAt(0);
  if (c === 167) return -1;
  if (c === 32) return 4;
  const i = tableIndex(c);
  if (c > 0 && i !== -1 && !state.unicode) return state.widths[i];
  const b = glyphByte(c, state.glyphSizes);
  if (b === 0) return 0;
  let start = b >>> 4, end = b & 15;
  if (end > 7) { end = 15; start = 0; }
  end++;
  return (Math.trunc((end - start) / 2)) + 1;
}

/** FontRenderer.getStringWidth. */
export function getStringWidth(s, state = font) {
  if (s == null) return 0;
  let total = 0, bold = false;
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i), w = getCharWidth(c, state);
    if (w < 0 && i < s.length - 1) {
      c = s.charCodeAt(++i);
      if (c === 108 || c === 76) bold = true; // l, L
      else if (c === 114 || c === 82) bold = false; // r, R
      w = 0;
    }
    total += w;
    if (bold && w > 0) total++;
  }
  return total;
}

/** Whether a character is drawn from ascii.png (true) or from a unicode page (false) with the current flag. */
export const usesAscii = (c, state = font) => c > 0 && tableIndex(c) !== -1 && !state.unicode;

/** Geometry of a unicode-page glyph in glyph pixels, or null when there is none (width byte 0). `advance` is the float pen move. */
export function unicodeGlyph(c, state = font) {
  const b = glyphByte(c, state.glyphSizes);
  if (b === 0) return null;
  const start = b >>> 4, end = (b & 15) + 1;
  const page = c >> 8, col = c % 16, row = (c & 255) >> 4;
  return { page, x: col * 16 + start, y: row * 16, w: end - start - 0.02, advance: (end - start) / 2 + 1, visible: start < 16 && end > start };
}
export const glyphPageUrl = (page) => versioned(`/media/1.7.10/font/unicode_page_${page.toString(16).padStart(2, "0")}.png`);

/** The CSS inline-block for one unicode-page glyph (see menu-screens.css .ug); bold draws it twice, 1 unit apart (0.5 with the unicode flag, FontRenderer.renderStringAtPos) and advances 1 more. The pen moves by the integer part of the advance (renderStringAtPos: (int) f), only the underline and strikethrough bars use the float one. */
export function glyphHtml(c, bold = false) {
  const g = unicodeGlyph(c);
  if (!g) return "";
  const adv = Math.trunc(g.advance + (bold ? 1 : 0)), unit = (n) => `calc(${+n.toFixed(4)}*var(--u))`;
  let inner = "";
  if (g.visible) {
    const base = `--p:url(${glyphPageUrl(g.page)});--mx:${unit(-g.x / 2)};--my:${unit(-g.y / 2)};width:${unit(g.w / 2)}`;
    inner = `<i style="${base}"></i>` + (bold ? `<i style="${base};left:${unit(font.unicode ? 0.5 : 1)}"></i>` : "");
  }
  return `<span class="ug" style="width:${unit(adv)}">${inner}</span>`;
}

import { versioned } from "./media-version.js";
// ---- Browser loading: ascii.png (possibly a resource pack's) and glyph_sizes.bin ----
export async function loadFontResources(fetchImpl = fetch) {
  const [sizes, widths] = await Promise.allSettled([loadGlyphSizes(fetchImpl), loadAsciiWidths()]);
  if (sizes.status === "fulfilled" && sizes.value) font.glyphSizes = sizes.value;
  if (widths.status === "fulfilled" && widths.value) font.widths = widths.value;
  changed();
}
async function loadGlyphSizes(fetchImpl) {
  const r = await fetchImpl(versioned("/media/1.7.10/font/glyph_sizes.bin"));
  if (!r.ok) return null;
  const buf = await r.arrayBuffer();
  return buf.byteLength >= 65536 ? new Int8Array(buf, 0, 65536) : null;
}
async function loadAsciiWidths() {
  const img = new Image();
  img.src = versioned("/media/1.7.10/font/ascii.png");
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  return readFontWidths(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}

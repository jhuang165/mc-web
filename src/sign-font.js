// FontRenderer text on a 2D canvas, for the sign text plane and the sign edit screen (the DOM text of bitmap-text.js cannot be
// painted into a texture). Layout reuses font-renderer.js (the same widths, glyph_sizes.bin geometry and unicode flag as every
// other text path); glyphs are cut from the real ascii.png / unicode_page_XX.png so resource-pack fonts apply.
//
// Bytecode-read from FontRenderer (bbu, javap), not executed:
//   renderStringAtPos: "§" + one of 0-9a-f sets the colour (and clears bold, italic, underline, strikethrough, obfuscation; an
//     unknown code after § counts as 15, white), k/l/m/n/o switch the styles on, r resets everything to the starting colour.
//     Bold draws the glyph again 1 pixel to the right (0.5 with the unicode flag) and advances 1 more; italic leans the glyph 1
//     pixel either way (top right, bottom left); strikethrough is a 1 px bar at y 3..4 and underline at y 8..9 (starting 1 px left)
//     over each character's advance; obfuscation swaps ascii.png characters for a random one of the same width.
//   renderDefaultChar: ascii.png cell (index % 16, index / 16) of 8 px, quad (charWidth - 1.01) x 7.99.
//   renderUnicodeChar: page cell 16 x 16 at start..end + 1 - 0.02 glyph px drawn at half size ((end - start - 0.02) / 2 x 7.99).
//   A sign line is drawn (text colour 0, no shadow) at x = -getStringWidth / 2 (int division), y = line * 10 - 20.
import { font, usesAscii, unicodeGlyph, glyphPageUrl, onFontChange, CHAR_TABLE, colorOf, randomGlyphIndex } from "./font-renderer.js";
import { versioned } from "./media-version.js";
import { onResourcesRefreshed } from "./resource-refresh.js";

const CODES = "0123456789abcdefklmnor";
const tableIndex = (c) => (c > 0 ? CHAR_TABLE.indexOf(String.fromCharCode(c)) : -1);
/**
 * The drawing ops of one string: {kind: "ascii", index, x, color, italic}, {kind: "unicode", code, glyph, x, color, italic} and
 * {kind: "bar", x0, y0, x1, y1, color}; x and the bars are in font pixels from the pen start, glyphs are drawn at y 0..7.99.
 * `width` is the pen move: the sum of the integer parts of the advances, as drawString's pen; `picks` counts the random glyphs drawn for
 * §k (non-zero: drawing the string again shows other glyphs, as FontRenderer does every frame).
 */
export function layoutString(s, color = 0, state = font, nextInt = (n) => Math.floor(Math.random() * n)) {
  const ops = [];
  let picks = 0;
  const pick = (n) => { picks++; return nextInt(n); };
  let x = 0, cur = color, bold = false, italic = false, under = false, strike = false, random = false;
  let text = String(s ?? "");
  if (state.bidi && state.bidiReorder) text = state.bidiReorder(text); // drawString -> bidiReorder when the language is bidirectional
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c === 167 && i + 1 < text.length) {
      let k = CODES.indexOf(text[++i].toLowerCase());
      if (k < 16) {
        if (k < 0) k = 15;
        random = bold = strike = under = italic = false;
        cur = colorOf(k, false, state);
      } else if (k === 16) random = true;
      else if (k === 17) bold = true;
      else if (k === 18) strike = true;
      else if (k === 19) under = true;
      else if (k === 20) italic = true;
      else { random = bold = strike = under = italic = false; cur = color; }
      continue;
    }
    let index = tableIndex(c);
    if (random && index !== -1) index = randomGlyphIndex(index, pick, state.widths); // the cell is replaced, never the character: the unicode flag draws c itself
    const start = x, offset = state.unicode ? 0.5 : 1;
    let advance = 0;
    const draw = (dx) => {
      if (c === 32) return;
      if (usesAscii(c, state)) ops.push({ kind: "ascii", index, x: start + dx, color: cur, italic });
      else { const glyph = unicodeGlyph(c, state); if (glyph?.visible) ops.push({ kind: "unicode", code: c, glyph, x: start + dx, color: cur, italic }); }
    };
    if (c === 32) advance = 4;
    else if (usesAscii(c, state)) advance = state.widths[index];
    else advance = unicodeGlyph(c, state)?.advance ?? 0;
    draw(0);
    if (bold) { draw(offset); advance += 1; }
    if (strike) ops.push({ kind: "bar", x0: start, y0: 3, x1: start + advance, y1: 4, color: cur });
    if (under) ops.push({ kind: "bar", x0: start - 1, y0: 8, x1: start + advance, y1: 9, color: cur });
    x += Math.trunc(advance); // the pen moves by (int) advance (renderStringAtPos); the bars above use the float advance
  }
  return { ops, width: x, picks };
}

// ---- Atlas images (ascii.png and the unicode pages, loaded on demand and tinted per colour) ----
const images = new Map(), tints = new WeakMap();
let loads = 0;
const subscribers = new Set();
/** Bumps whenever an atlas finishes loading or the resources refresh: a drawn sign is stale once this changes. */
export const atlasVersion = () => loads;
export const onAtlasChange = (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); };
const bump = () => { loads++; for (const fn of subscribers) fn(); };
function image(url) {
  if (typeof Image === "undefined") return null;
  let entry = images.get(url);
  if (!entry) {
    entry = { img: new Image(), ready: false };
    entry.img.onload = () => { entry.ready = true; bump(); };
    entry.img.src = url;
    images.set(url, entry);
  }
  return entry.ready ? entry.img : null;
}
onResourcesRefreshed(() => { images.clear(); bump(); });

const hex = (c) => "#" + (c & 0xffffff).toString(16).padStart(6, "0");
function tinted(img, color) {
  let byColor = tints.get(img);
  if (!byColor) tints.set(img, (byColor = new Map()));
  let canvas = byColor.get(color);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const g = canvas.getContext("2d");
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = hex(color);
    g.fillRect(0, 0, canvas.width, canvas.height);
    byColor.set(color, canvas);
  }
  return canvas;
}

/**
 * Draws a string with its pen start at (x, y) font pixels; `scale` canvas pixels per font pixel. Colour defaults to 0 (black),
 * the sign colour; like FontRenderer a plain colour without alpha bits is opaque. No shadow. Returns true when the string drew random
 * (§k) glyphs, i.e. when drawing it again would show different ones.
 */
export function drawFontString(ctx, s, x, y, scale, color = 0, state = font, nextInt) {
  const { ops, picks } = layoutString(s, color, state, nextInt);
  ctx.imageSmoothingEnabled = false;
  const ascii = ops.some((o) => o.kind === "ascii") ? image(versioned("/media/1.7.10/font/ascii.png")) : null;
  for (const o of ops) {
    if (o.kind === "bar") { ctx.fillStyle = hex(o.color); ctx.fillRect((x + o.x0) * scale, (y + o.y0) * scale, (o.x1 - o.x0) * scale, (o.y1 - o.y0) * scale); continue; }
    const lean = o.italic ? 1 : 0;
    ctx.save();
    // Italic: the glyph's top moves right by 1 and its bottom left by 1 (a shear of 2 / 8 about the middle).
    if (lean) ctx.transform(1, 0, -0.25, 1, 0.25 * (y + 4) * scale, 0);
    if (o.kind === "ascii") {
      if (!ascii) { ctx.restore(); continue; }
      const cell = ascii.naturalWidth / 16, k = cell / 8, w = state.widths[o.index] - 1.01;
      if (w > 0) ctx.drawImage(tinted(ascii, o.color), (o.index % 16) * cell, Math.trunc(o.index / 16) * cell, w * k, 7.99 * k, (x + o.x) * scale, y * scale, w * scale, 7.99 * scale);
    } else {
      const page = image(glyphPageUrl(o.glyph.page));
      if (page) {
        const k = page.naturalWidth / 256, g = o.glyph;
        ctx.drawImage(tinted(page, o.color), g.x * k, g.y * k, g.w * k, 16 * k, (x + o.x) * scale, y * scale, (g.w / 2) * scale, 7.99 * scale);
      }
    }
    ctx.restore();
  }
  return picks > 0;
}

export { getStringWidth } from "./font-renderer.js";

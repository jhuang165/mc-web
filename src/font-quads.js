// FontRenderer.drawString / drawStringWithShadow as a primitive list: the glyph quads (ascii.png and unicode pages) and the
// underline/strikethrough bars, with the native float arithmetic, shadow pass offsets and style leakage. Replayed against the
// unchanged bbu through tools/probes/FontStyleProbe.java (public/research/font-style-reference.json, src/font-style.test.js).
//
// Bytecode-read from renderStringAtPos (bbu.a(String, boolean)) and confirmed by the probe:
//   "§" + 0-9a-f clears random/bold/strike/underline/italic and sets the colour (shadow pass: code + 16, the colour divided by 4); k, l,
//     m, n, o switch a style on; r clears them and restores the starting colour; an unknown code counts as 15; "§" at the end is a glyph.
//   f = 0.5 with the unicode flag, else 1. The shadow pass offsets a glyph by -f (x and y) when the character is not an ascii.png one
//     (NUL, not in the table, or the unicode flag): that pass is drawn at +1 +1, so such glyphs sit 1 - f from their text.
//   Bold draws the glyph again f to the right and widens the advance by 1. Italic moves the top corners +1 and the bottom corners -1.
//   Strikethrough: bar (x, y + 3) to (x + advance, y + 4); underline: (x - 1, y + 8) to (x + advance, y + 9), drawn in the glyph colour for
//     every character including spaces; `advance` is the float one (unicode glyphs advance (end - start) / 2 + 1, bold + 1).
//   The pen then moves by (int) advance, so half advances never accumulate, and the style flags are NOT reset between the shadow pass and
//     the normal pass (e1 reset at drawString start only): a trailing §n of the shadow pass underlines the start of the second pass.
import { font, getStringWidth, CHAR_TABLE, colorCodeTable, randomGlyphIndex } from "./font-renderer.js";

const f32 = Math.fround;
const F799 = f32(7.99), F1598 = f32(15.98), F001 = f32(0.01), F002 = f32(0.02);
const CODES = "0123456789abcdefklmnor";
const COLOR_TABLE = colorCodeTable(false); // a state without a colour table (tests) is the non-anaglyph one
const tableIndex = (c) => CHAR_TABLE.indexOf(String.fromCharCode(c));
const rgba = (c) => [f32(((c >> 16) & 255) / 255), f32(((c >> 8) & 255) / 255), f32((c & 255) / 255), f32(((c >>> 24) & 255) / 255)];

/** The glyph quad of renderDefaultChar: vertices [x, y, u, v] in triangle strip order, plus the advance (width of the character). */
function defaultQuad(idx, c, x, y, italic, state) {
  const u = (idx % 16) * 8, v = Math.trunc(idx / 16) * 8, it = italic ? 1 : 0, w = state.widths[idx], wf = f32(w - F001);
  const right = f32(f32(x + wf) - 1);
  return {
    tex: "ascii",
    v: [
      [f32(x + it), y, f32(u / 128), f32(v / 128)],
      [f32(x - it), f32(y + F799), f32(u / 128), f32(f32(v + F799) / 128)],
      [f32(right + it), y, f32(f32(f32(u + wf) - 1) / 128), f32(v / 128)],
      [f32(right - it), f32(y + F799), f32(f32(f32(u + wf) - 1) / 128), f32(f32(v + F799) / 128)],
    ],
    advance: w,
  };
}
/** renderUnicodeChar: page cell 16 x 16 cut from start to end + 1 - 0.02, drawn at half size. */
function unicodeQuad(c, x, y, italic, state) {
  const b = state.glyphSizes ? state.glyphSizes[c] : 0;
  if (b === 0) return { quad: null, advance: 0 };
  const start = f32(b >>> 4), end = f32((b & 15) + 1);
  const cu = f32(f32((c % 16) * 16) + start), cv = (c & 255) >> 4 << 4, w = f32(f32(end - start) - F002), it = italic ? 1 : 0;
  const right = f32(x + f32(w / 2));
  return {
    tex: `page${((c >> 8) & 255).toString(16).padStart(2, "0")}`,
    quad: [
      [f32(x + it), y, f32(cu / 256), f32(cv / 256)],
      [f32(x - it), f32(y + F799), f32(cu / 256), f32(f32(cv + F1598) / 256)],
      [f32(right + it), y, f32(f32(cu + w) / 256), f32(cv / 256)],
      [f32(right - it), f32(y + F799), f32(f32(cu + w) / 256), f32(f32(cv + F1598) / 256)],
    ],
    advance: f32(f32(f32(end - start) / 2) + 1),
  };
}

/**
 * The primitives of one renderString pass. `st` carries the style flags across passes (drawString resets them once). Returns the
 * primitives and the pen x (int) at the end. Primitive: {k: "g", tex, c: rgba, v: [[x, y, u, v] x 4]} or {k: "b", c, v: [[x, y] x 4]}.
 */
function pass(s, x, y, color, shadow, st, state, rand) {
  if ((color & 0xfc000000) === 0) color |= 0xff000000;
  if (shadow) color = ((color & 0xfcfcfc) >> 2) | (color & 0xff000000);
  const base = rgba(color);
  let cur = base;
  const prims = [];
  let px = f32(x), py = f32(y);
  const text = String(s ?? "");
  const half = state.unicode ? 0.5 : 1;
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c === 167 && i + 1 < text.length) {
      let k = CODES.indexOf(text[++i].toLowerCase());
      if (k < 16) {
        st.random = st.bold = st.strike = st.under = st.italic = false;
        if (k < 0 || k > 15) k = 15;
        if (shadow) k += 16;
        const col = (state.colorCode ?? COLOR_TABLE)[k];
        const [r, g, b] = rgba(col);
        cur = [r, g, b, base[3]];
      } else if (k === 16) st.random = true;
      else if (k === 17) st.bold = true;
      else if (k === 18) st.strike = true;
      else if (k === 19) st.under = true;
      else if (k === 20) st.italic = true;
      else { st.random = st.bold = st.strike = st.under = st.italic = false; cur = base; }
      continue;
    }
    let idx = tableIndex(c);
    if (st.random && idx !== -1) {
      idx = randomGlyphIndex(idx, rand, state.widths);
    }
    const flag = (c === 0 || idx === -1 || state.unicode) && shadow;
    const draw = (dx) => {
      if (flag) { px = f32(px - half); py = f32(py - half); }
      if (dx) px = f32(px + dx);
      let r;
      if (c === 32) r = { advance: 4 };
      else if (idx !== -1 && !state.unicode) r = defaultQuad(idx, c, px, py, st.italic, state);
      else {
        const u = unicodeQuad(c, px, py, st.italic, state);
        r = { advance: u.advance, quad: u.quad, tex: u.tex };
      }
      const quad = r.v ?? r.quad;
      if (quad) prims.push({ k: "g", tex: r.tex, c: cur, v: quad });
      if (dx) px = f32(px - dx);
      if (flag) { px = f32(px + half); py = f32(py + half); }
      return r.advance;
    };
    let adv = draw(0);
    if (st.bold) { draw(half); adv = f32(adv + 1); } // the second glyph's own return value is dropped (pop)
    if (st.strike) { const y4 = f32(py + Math.trunc(9 / 2)); prims.push({ k: "b", c: cur, v: [[px, y4], [f32(px + adv), y4], [f32(px + adv), f32(y4 - 1)], [px, f32(y4 - 1)]] }); }
    if (st.under) { const y9 = f32(py + 9), x0 = f32(px - 1); prims.push({ k: "b", c: cur, v: [[x0, y9], [f32(px + adv), y9], [f32(px + adv), f32(y9 - 1)], [x0, f32(y9 - 1)]] }); }
    px = f32(px + Math.trunc(adv));
  }
  return { prims, x: Math.trunc(px) };
}
const newStyle = () => ({ random: false, bold: false, strike: false, under: false, italic: false });

/**
 * drawString(s, x, y, color, shadow) -> {prims, x}: the shadow pass (at +1 +1, shadow colour) then the normal pass, `x` is the value
 * the native method returns (the larger of both passes' end x). `rand(n)` is Random.nextInt(n) for §k. `bidi` applies the bidiReorder first when the font is bidirectional.
 */
export function drawStringPrims(s, x, y, color, shadow, state = font, rand = (n) => Math.floor(Math.random() * n), reorder = state.bidi ? state.bidiReorder : null) {
  const st = newStyle();
  const text = reorder && s != null ? reorder(String(s)) : s;
  if (shadow) {
    const a = pass(text, x + 1, y + 1, color, true, st, state, rand);
    const b = pass(text, x, y, color, false, st, state, rand);
    return { prims: [...a.prims, ...b.prims], x: Math.max(a.x, b.x) };
  }
  return pass(text, x, y, color, false, st, state, rand);
}
export { getStringWidth };

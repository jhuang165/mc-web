// In-game GUI text drawn with the 1.7.10 FontRenderer glyph model instead of the page font. The renderer is the one the menus and
// chat already use (menu-ui.js textHtml: ascii.png glyphs through the Minecraft face, unicode_page glyphs from glyph_sizes.bin, the
// native shadow colour, §-codes); this file only adds the in-game call sites and a cache so a per-frame caller costs a Map lookup.
//
// Native positions (read from the unchanged 1.7.10 bytecode with javap, not probed):
//   RenderItem.renderItemOverlayIntoGUI (bny.a(bbu,bqf,add,int,int,String)): the count (or the override string) shows when
//     count > 1 or the string is not null, drawStringWithShadow(s, x + 19 - 2 - getStringWidth(s), y + 6 + 3, 0xFFFFFF): the text's
//     right edge is 17 px right of the item's left edge and its top 9 px below the item's top.
//   GuiScreen.drawHoverText (bdw.a(List,int,int)): width = max getStringWidth(line), x + 12 / y - 12, height 8 (+ 2 + 10 * (n - 1)
//     with more than one line); fill 0xF0100010 over x-3..x+w+3 by y-3..y+h+3 (and the 1 px frame rows), border gradient 0x505000FF
//     to 0x5028007F; every line drawStringWithShadow(line, x, y, -1) with y += 2 after the first line and y += 10 after each other.
//   GuiContainer.drawGuiContainerForegroundLayer: titles drawString(.., 0x404040) without a shadow.
//   GuiIngame: the XP level is drawString'd four times in black at +/-1 px and once in 0x80FF20 (8453920), no shadow, centred.
import { textHtml } from "./menu-ui.js";
import { font, getStringWidth } from "./font-renderer.js";

const CACHE_LIMIT = 600;
let cache = new Map();
/** textHtml through a cache keyed by the font state (a language or resource-pack change bumps font.version). */
export function bitmapHtml(s, color = 0xffffff) {
  const key = `${font.version}|${font.unicode ? 1 : 0}|${color}|${s}`;
  let html = cache.get(key);
  if (html === undefined) {
    if (cache.size >= CACHE_LIMIT) cache = new Map();
    html = textHtml(String(s), color);
    cache.set(key, html);
  }
  return html;
}

/** RenderItem count: the string and its offset from the item's top-left (right aligned at x 17, top at y 9). */
export function countLayout(count, width = getStringWidth) {
  if (!(Number.isFinite(count) && count > 1)) return null;
  const text = String(Math.floor(count));
  return { text, x: 19 - 2 - width(text), y: 6 + 3 };
}
/** Stack count markup (empty string for 0/1 items). `cls` adds "empty"/"full" (yellow). */
export function countHtml(count, cls = "") {
  const l = countLayout(count);
  return l ? `<b class="item-count mc-text${cls ? " " + cls : ""}">${bitmapHtml(l.text, null)}</b>` : "";
}
/** The "0" shown for an empty creative slot override. */
export const zeroCountHtml = () => `<b class="item-count mc-text empty">${bitmapHtml("0", null)}</b>`;

const COLOR_CODES = { black: "0", darkblue: "1", darkgreen: "2", darkaqua: "3", darkred: "4", purple: "5", gold: "6", gray: "7", darkgray: "8", blue: "9", green: "a", aqua: "b", red: "c", pink: "d", yellow: "e", white: "f", bold: "l", italic: "o" };
/** One tooltip line as the FontRenderer string: colour words ("blue bold") become § codes, italic names get §o. */
export function tooltipString(line, index) {
  const words = String(line.color ?? (index ? "gray" : "white")).split(" ");
  return words.map((w) => (COLOR_CODES[w] ? "§" + COLOR_CODES[w] : "")).join("") + (line.italic ? "§o" : "") + line.text;
}
/** drawHoverText geometry for the lines: content width, box height and each line's y offset (all in GUI pixels). */
export function tooltipLayout(strings, width = getStringWidth) {
  let w = 0;
  for (const s of strings) w = Math.max(w, width(s));
  let h = 8, y = 0;
  const ys = [];
  for (let i = 0; i < strings.length; i++) { ys.push(y); if (i === 0) y += 2; y += 10; }
  if (strings.length > 1) h += 2 + (strings.length - 1) * 10;
  return { width: w, height: h, ys };
}
/** Markup for a tooltip: one block per line plus the widest line in GUI pixels (the box is CSS, see container-ui.css .slot-tooltip). */
export function tooltipHtml(lines) {
  const strings = lines.map(tooltipString);
  const { width } = tooltipLayout(strings);
  return { width, html: strings.map((s) => `<span class="tl">${s.replace(/§./g, "") === "" ? "&nbsp;" : bitmapHtml(s, 0xffffff)}</span>`).join("") };
}

/** Container titles / labels: 0x404040, no shadow, left aligned. Idempotent per text. */
export function drawLabel(el, text, color = 0x404040) {
  if (!el || el.dataset.bitmap === text) return;
  el.dataset.bitmap = text;
  el.classList.add("mc-text", "flat");
  el.innerHTML = bitmapHtml(text, color);
}
export function drawLabels(root, selector = ".gui-label,.native-bag-label,.native-crafting-label,.chest-bag-label,.merchant-bag-label,#modal-title") {
  for (const el of root.querySelectorAll(selector)) drawLabel(el, el.dataset.bitmap ?? el.textContent);
}

/** The XP level: four black copies at +/-1 and the green one on top (GuiIngame). */
export function xpLevelHtml(level) {
  if (!level) return "";
  const s = String(level), copy = (dx, dy, c, top) => `<span class="xp-copy mc-text flat" style="${top ? "" : `left:calc(${dx}*var(--u));top:calc(${dy}*var(--u));`}position:${top ? "relative" : "absolute"}">${bitmapHtml(s, c)}</span>`;
  return `<span style="position:relative;display:inline-block">${[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => copy(x, y, 0, false)).join("")}${copy(0, 0, 0x80ff20, true)}</span>`;
}

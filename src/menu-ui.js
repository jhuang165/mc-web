// DOM widgets for the 1.7.10 menu screens: GuiButton, GuiOptionSlider, GuiTextField and GuiSlot
// drawn from gui/widgets.png and gui/options_background.png at the GUI scale (--u is one scaled
// unit in CSS pixels). Positions come from menu-screens.js. Buttons act on mouse press, as
// GuiScreen.mouseClicked does, and play gui.button.press.
import { textWidth, trimToWidth, splitLines, shadowColor, charWidth, knobOffset, sliderValue, slotMetrics, slotAt, scaledSize } from "./menu-screens.js";
import { Panorama } from "./menu-panorama.js";
import { onResourcesRefreshed } from "./resource-refresh.js";
import { font, usesAscii, glyphHtml, colorOf, randomGlyphIndex, CHAR_TABLE } from "./font-renderer.js";

const hex = (c) => "#" + (c & 0xffffff).toString(16).padStart(6, "0");
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const px = (n) => `calc(${n}*var(--u))`;
const at = (x, y, w, h) => `left:${px(x)};top:${px(y)}` + (w != null ? `;width:${px(w)}` : "") + (h != null ? `;height:${px(h)}` : "");
// FontRenderer colour runs: a section sign and code switch the colour (r resets). `color` null
// draws the base runs in the widget's own --c / --cs (a button's state colour). §l bold (the glyph drawn again one pixel
// right, one pixel wider), §o italic, §n underline, §m strikethrough and §k obfuscated (each glyph replaced by a random one of
// the same width) as FontRenderer.renderStringAtPos; a colour code or §r clears them.
// §k (renderStringAtPos): a character of the 256 entry ascii.png table is replaced by the cell fontRandom.nextInt(256) lands on first with
// the same width (all 256 cells are candidates; the unused cells draw blank), a new pick on every drawn frame, and with the unicode flag
// or for a character outside the table nothing changes. Spans of such runs carry their source text (`kr`) and one animation-frame loop
// re-picks them while any is on the page.
const nextInt = (n) => Math.floor(Math.random() * n);
const obfuscate = (s) => {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (ch === " " || !usesAscii(c)) { out += ch; continue; }
    const idx = CHAR_TABLE.indexOf(ch), j = randomGlyphIndex(idx, nextInt);
    out += CHAR_TABLE[j] === "\u0000" ? String.fromCharCode(0xe000 + font.widths[idx]) : CHAR_TABLE[j]; // U+E000 + w: a blank cell of width w
  }
  return out;
};
// Characters drawn from ascii.png stay text; the others (everything when the unicode flag is on) are unicode-page glyphs.
function runHtml(text, bold, random) {
  if (random) text = obfuscate(text);
  let html = "", seg = "";
  for (let k = 0; k < text.length; k++) {
    const c = text.charCodeAt(k);
    if (c >= 0xe000 && c < 0xe100) { if (seg) { html += escapeHtml(seg); seg = ""; } html += `<span class="ug" style="width:calc(${c - 0xe000}*var(--u))"></span>`; continue; }
    if (usesAscii(c) || (c === 32 && !font.unicode)) { seg += text[k]; continue; }
    if (seg) { html += escapeHtml(seg); seg = ""; }
    html += c === 32 ? '<span class="ug" style="width:calc(4*var(--u))"></span>' : glyphHtml(c, bold);
  }
  return html + escapeHtml(seg);
}
let krFrames = 0, krRunning = false;
function krTick() {
  const nodes = document.querySelectorAll(".kr");
  krFrames = nodes.length ? 0 : krFrames + 1;
  for (const el of nodes) el.innerHTML = runHtml(el.dataset.k, el.dataset.b === "1", true);
  if (krFrames < 30) requestAnimationFrame(krTick); else krRunning = false;
}
function startKr() {
  if (krRunning || typeof requestAnimationFrame !== "function" || typeof document === "undefined") return;
  krRunning = true; krFrames = 0;
  requestAnimationFrame(krTick);
}
export function textHtml(s, color = 0xffffff) {
  if (font.bidi && s) s = font.bidiReorder(String(s)); // FontRenderer.renderString: bidiReorder of the whole string, colour codes included
  let out = "", run = "", cur = color, curShadow = null, under = false, bold = false, italic = false, strike = false, random = false;
  const style = (c) => {
    let css = c == null ? "color:var(--c);--sh:var(--cs)" : `color:${hex(c)};--sh:${hex(curShadow ?? shadowColor(c))}`;
    if (bold) css += ";letter-spacing:var(--u);text-shadow:var(--u) 0 0 currentColor,var(--u) var(--u) 0 var(--sh),calc(2*var(--u)) var(--u) 0 var(--sh)";
    return css;
  };
  // Underline / strikethrough are 1 unit bars (y + 8 and y + 3, from 1 left of the run, drawn in the glyph colour and shadowed like text)
  // and italic leans the glyphs 1 unit right at the top and 1 left at the bottom, for ascii.png and unicode glyphs alike
  // (renderStringAtPos / renderUnicodeChar); see menu-screens.css .tf.
  const flush = () => {
    if (run) {
      const cls = [under && "tu", strike && "ts", italic && "ti"].filter(Boolean);
      const kr = random && !font.unicode && [...run].some((ch) => ch !== " " && usesAscii(ch.charCodeAt(0)));
      if (kr) { cls.push("kr"); startKr(); }
      out += `<span${cls.length ? ` class="${(under || strike || italic ? "tf " : "") + cls.join(" ")}"` : ""} style="${style(cur)}"${kr ? ` data-k="${escapeHtml(run)}" data-b="${bold ? 1 : 0}"` : ""}>${runHtml(run, bold, random)}</span>`;
    }
    run = "";
  };
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "§" && i + 1 < s.length) {
      flush();
      const code = s[++i].toLowerCase(), k = "0123456789abcdef".indexOf(code);
      // bbu: indexOf in "0123456789abcdefklmnor" below 16 (an unknown code is -1) resets the styles and takes colour 15; the colour comes
      // from the constructor's table (anaglyph converted when the game started with Anaglyph on, shadow = entry + 16)
      if (code === "r") { cur = color; curShadow = null; under = bold = italic = strike = random = false; }
      else if (k >= 0 || !"klmno".includes(code)) { const ci = k >= 0 ? k : 15; cur = colorOf(ci); curShadow = colorOf(ci, true); under = bold = italic = strike = random = false; }
      else if (code === "n") under = true;
      else if (code === "l") bold = true;
      else if (code === "o") italic = true;
      else if (code === "m") strike = true;
      else if (code === "k") random = true;
      continue;
    }
    run += s[i];
  }
  flush();
  return out;
}
const el = (tag, cls, style = "") => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style) e.style.cssText = style;
  return e;
};
const plain = (s) => String(s).replace(/§./g, "");

export class Gui {
  // scale(): the GUI scale in CSS pixels; sound(): the button press; notice(text): explains a
  // button this build cannot act on; inGame(): whether a world is open behind the screen.
  constructor(root, { scale, sound, notice, inGame }) {
    Object.assign(this, { root, scale, sound, notice, inGame });
    this.canvas = el("canvas", "mc-panorama");
    this.layer = el("div", "mc-screen");
    root.append(this.canvas, el("div", "mc-panorama-shade"), this.layer);
    this.screen = null;
    this.drag = this.list = null;
    this.fields = new Set();
    root.addEventListener("wheel", (e) => {
      e.preventDefault();
      // GuiSlot reads Mouse.getEventDWheel anywhere on the screen: half a slot per notch.
      if (this.list && e.deltaY) this.list.wheel(e.deltaY > 0 ? 1 : -1);
      else if (this.screen?.wheel && e.deltaY) this.screen.wheel(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    addEventListener("pointermove", (e) => this.drag?.move(this.mouse(e)));
    const up = (e) => { const d = this.drag; this.drag = null; d?.up?.(this.mouse(e)); };
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    // GuiTextField.mouseClicked: a press outside a focused field takes its focus away.
    root.addEventListener("pointerdown", (e) => {
      const box = document.activeElement?.closest?.(".mc-field");
      if (box && !box.contains(e.target)) document.activeElement.blur();
    }, true);
    root.addEventListener("contextmenu", (e) => e.preventDefault());
    this.frame = this.frame.bind(this);
  }
  get open() { return !!this.screen; }
  // Mouse.getX() * width / displayWidth, in GUI units.
  mouse(e) { const r = this.layer.getBoundingClientRect(); return { x: Math.floor((e.clientX - r.left) / this.u), y: Math.floor((e.clientY - r.top) / this.u), button: e.button }; }
  show(screen) {
    const old = this.screen;
    this.screen = screen;
    old?.close?.();
    this.build();
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }
  hide() {
    const old = this.screen;
    this.screen = null;
    old?.close?.();
    this.clear();
    this.root.classList.add("hidden");
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  clear() {
    for (const f of this.fields) f.dispose();
    this.fields.clear();
    this.list = this.drag = null;
    this.layer.replaceChildren();
  }
  // GuiScreen.setWorldAndResolution: clear the widgets and run initGui at the current size.
  build() {
    if (!this.screen) return;
    const focused = document.activeElement?.closest?.(".mc-field") ? document.activeElement.getAttribute("aria-label") : null;
    this.clear();
    this.u = this.scale();
    const { w, h } = scaledSize(innerWidth, innerHeight, this.u);
    this.w = w;
    this.h = h;
    this.layer.style.cssText = `width:${px(w)};height:${px(h)}`;
    const kind = this.screen.background?.() ?? "default";
    this.root.dataset.background = kind === "default" ? (this.inGame() ? "world" : "dirt") : kind;
    this.root.dataset.screen = this.screen.id ?? "";
    this.root.classList.remove("hidden");
    if (kind === "panorama") {
      if (!this.panorama) { this.panorama = new Panorama(this.canvas); onResourcesRefreshed((gen) => this.panorama.reload(gen)); }
      const dpr = Math.min(2, devicePixelRatio || 1);
      this.canvas.width = Math.round(w * this.u * dpr);
      this.canvas.height = Math.round(h * this.u * dpr);
      this.canvas.style.cssText = `width:${px(w)};height:${px(h)}`;
    }
    this.screen.init(this, w, h);
    if (focused) this.layer.querySelector(`.mc-field input[aria-label="${CSS.escape(focused)}"]`)?.focus();
  }
  // GuiScreen.updateScreen: Minecraft.runTick calls it once per client tick on the open screen (main.js feeds it).
  tick() { this.screen?.tick?.(); }
  frame(now) {
    this.raf = requestAnimationFrame(this.frame);
    if (!this.screen) return;
    this.screen.frame?.(now);
    if (this.root.dataset.background === "panorama" && this.screen.panoramaTimer) this.panorama?.render(this.screen.panoramaTimer(now), this.w, this.h);
  }
  // Keys go to the open screen first; Escape otherwise closes it (GuiScreen.keyTyped, key 1).
  key(e) {
    if (this.screen?.key?.(e)) { e.preventDefault(); return; }
    if (e.code === "Escape") { e.preventDefault(); this.screen?.escape?.(); }
  }
  text(s, x, y, { color = 0xffffff, center = false, right = false, shadow = true, parent = this.layer } = {}) {
    const e = el("div", "mc-text" + (shadow ? "" : " flat"));
    const handle = {
      el: e,
      set(text, c = color) {
        const width = textWidth(text);
        // drawCenteredString: x - getStringWidth / 2.
        e.style.cssText = at(center ? x - Math.trunc(width / 2) : right ? x - width : x, y);
        e.innerHTML = textHtml(text, c);
      },
    };
    handle.set(s);
    parent.append(e);
    return handle;
  }
  // FontRenderer.drawSplitString: word-wrapped lines 9 units apart, without a shadow.
  splitText(s, x, y, width, color) {
    const e = el("div", "mc-split");
    // renderSplitString: a bidirectional language right aligns every line on the reordered width, at x + width - that width
    splitLines(s, width).forEach((line, i) => this.text(line, font.bidi ? x + width - textWidth(font.bidiReorder(line)) : x, y + 9 * i, { color, shadow: false, parent: e }));
    this.layer.append(e);
    return e;
  }
  image(cls, x, y, w, h, parent = this.layer) {
    const e = el("div", cls, at(x, y, w, h));
    parent.append(e);
    return e;
  }
  // The GuiButton element: two halves of a widgets.png row (u 0 and u 200 - width / 2) and the
  // label at (width / 2 - textWidth / 2, (height - 8) / 2).
  widget(r, cls, parent) {
    const b = el("button", "mc-button" + (cls ? " " + cls : ""), at(r.x, r.y, r.w, r.h) + `;--hw:${Math.trunc(r.w / 2)}`);
    b.type = "button";
    const label = el("span", "mc-text mc-label");
    b.append(label);
    b.addEventListener("mousedown", (e) => e.preventDefault());
    parent.append(b);
    const handle = {
      el: b, enabled: true, visible: true, label: "",
      set(s) {
        handle.label = s;
        label.style.cssText = at(Math.trunc(r.w / 2) - Math.trunc(textWidth(s) / 2), Math.trunc((r.h - 8) / 2));
        label.innerHTML = textHtml(s, null);
        b.setAttribute("aria-label", plain(s));
      },
      enable(on) { handle.enabled = !!on; b.classList.toggle("disabled", !on); b.setAttribute("aria-disabled", String(!on)); },
      show(on) { handle.visible = !!on; b.hidden = !on; },
    };
    return handle;
  }
  // GuiButton: v 66, 86 when hovered, 46 when disabled; label 0xE0E0E0 / 0xFFFFA0 / 0xA0A0A0.
  // `reason` marks a vanilla button this browser build cannot act on: drawn disabled, a press
  // explains why instead of doing nothing.
  button(r, label, action, { enabled = true, reason = "", parent = this.layer, cls = "", silent = false } = {}) {
    const h = this.widget(r, cls, parent);
    h.set(label);
    h.enable(enabled && !reason);
    if (reason) h.el.title = reason;
    const press = () => {
      if (!h.visible) return;
      if (!h.enabled) { if (reason) this.notice(reason); return; }
      if (!silent) this.sound();
      action?.(h);
    };
    h.el.addEventListener("pointerdown", (e) => { if (e.button === 0) press(); });
    // Keyboard activation (Enter / Space on a focused button) arrives as a click with detail 0.
    h.el.addEventListener("click", (e) => { if (e.detail === 0) press(); });
    return h;
  }
  // GuiButtonLanguage: the 20 x 20 globe at widgets.png (0, 106), (0, 126) when hovered.
  languageButton(r, action) {
    const h = this.button(r, "", action, { cls: "mc-language" });
    h.el.setAttribute("aria-label", "Language...");
    return h;
  }
  // GuiOptionSlider (and GuiScreenOptionsSounds.Button): the disabled row as background, an
  // 8-unit knob at x + (int)(value * (width - 8)). change(value) applies a normalised value and
  // returns the snapped { value, label }. Category sound sliders click on release instead of press.
  slider(r, { value, label, change, enabled = true, reason = "", parent = this.layer, releaseSound = false }) {
    const h = this.widget(r, "mc-slider", parent);
    const knob = el("i", "mc-knob");
    h.el.prepend(knob);
    h.el.setAttribute("role", "slider");
    h.el.setAttribute("aria-valuemin", "0");
    h.el.setAttribute("aria-valuemax", "1");
    let current = value;
    const place = (v, text) => {
      current = v;
      knob.style.left = px(knobOffset(v, r.w));
      h.el.setAttribute("aria-valuenow", String(v));
      h.set(text);
    };
    place(value, label);
    h.enable(enabled && !reason);
    if (reason) h.el.title = reason;
    const update = (v) => { const out = change(v); place(out.value, out.label); };
    h.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (!h.enabled) { if (reason) this.notice(reason); return; }
      if (!releaseSound) this.sound();
      update(sliderValue(this.mouse(e).x, r.x, r.w));
      this.drag = { move: (m) => update(sliderValue(m.x, r.x, r.w)), up: () => { if (releaseSound) this.sound(); } };
    });
    h.el.addEventListener("keydown", (e) => {
      if (!h.enabled || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      e.preventDefault();
      e.stopPropagation();
      update(Math.min(1, Math.max(0, current + (e.key === "ArrowRight" ? 1 : -1) / (r.w - 8))));
    });
    return h;
  }
  // GuiTextField with its background: a 0xA0A0A0 frame round a black box, text at
  // (x + 4, y + (height - 8) / 2) scrolled by lineScrollOffset, a blinking "_" at the end or a
  // 0xD0D0D0 bar inside the text, and the selection drawn with GL_OR_REVERSE in blue. A
  // transparent <input> takes the typing, clipboard and selection keys.
  // `secret`: a browser addition for account passwords, drawn as "*" per character. `enabled` false is setEnabled(false): the text
  // (and the "_" cursor) in the disabledColor 0x707070 instead of the enabledColor 0xE0E0E0 (bcd constructor, drawTextBox), and no
  // edits; the field can still take focus, select and copy, as natively.
  field(r, { value = "", maxLength = 32, focus = false, input, label = "", secret = false, enabled = true }) {
    const color = enabled ? 0xe0e0e0 : 0x707070;
    const box = el("div", "mc-field", at(r.x - 1, r.y - 1, r.w + 2, r.h + 2));
    const ty = Math.trunc((r.h - 8) / 2), width = r.w - 8;
    const mirror = el("div", "mc-field-draw", at(1, 1, r.w, r.h));
    const field = el("input", "", at(5, ty + 1, width, 8));
    field.type = secret ? "password" : "text";
    field.maxLength = maxLength;
    field.spellcheck = false;
    field.autocomplete = secret ? "current-password" : "off";
    field.readOnly = !enabled;
    const drawn = () => (secret ? "*".repeat(field.value.length) : field.value);
    field.value = value.slice(0, maxLength);
    field.setAttribute("aria-label", label);
    box.append(mirror, field);
    this.layer.append(box);
    let scroll = 0, lastEnd = -1, lastText = null;
    // trimStringToWidth(text, width, true): how many trailing characters fit.
    const reverseFit = (s) => { let w = 0, i = s.length; while (i > 0 && (w += textWidth(s[i - 1])) <= width) i--; return s.length - i; };
    // GuiTextField.setSelectionPos(selectionEnd): keep the moving end of the selection in view.
    const follow = (text, p) => {
      if (scroll > text.length) scroll = text.length;
      const l = trimToWidth(text.slice(scroll), width).length + scroll;
      if (p === scroll) scroll -= reverseFit(text);
      if (p > l) scroll += p - l;
      else if (p <= scroll) scroll -= scroll - p;
      scroll = Math.max(0, Math.min(scroll, text.length));
    };
    const render = () => {
      const text = drawn(), back = field.selectionDirection === "backward";
      const cursor = (back ? field.selectionEnd : field.selectionStart) ?? text.length;
      const end = (back ? field.selectionStart : field.selectionEnd) ?? cursor;
      if (end !== lastEnd || text !== lastText) follow(text, end);
      lastEnd = end;
      lastText = text;
      // drawTextBox, relative to x.
      const l = 4, s = trimToWidth(text.slice(scroll), width), j = cursor - scroll, k = Math.min(end - scroll, s.length);
      const shown = j >= 0 && j <= s.length, bar = cursor < text.length || text.length >= maxLength;
      let html = "", j1 = l;
      const draw = (str, x) => { html += `<div class="mc-text" style="${at(x, ty)}">${textHtml(str, color)}</div>`; return x + textWidth(str) + 1; };
      if (s.length) j1 = draw(shown ? s.slice(0, j) : s, l);
      let k1 = j1;
      if (!shown) k1 = j > 0 ? l + r.w : l;
      else if (bar) { k1 = j1 - 1; j1--; }
      if (s.length && shown && j < s.length) draw(s.slice(j), j1);
      if (document.activeElement === field && shown) {
        html += bar ? `<i class="mc-caret" style="${at(k1, ty - 1, 1, 11)}"></i>` : `<div class="mc-text mc-caret" style="${at(k1, ty)}">${textHtml("_", color)}</div>`;
      }
      if (k !== j) {
        // drawCursorVertical(k1, y - 1, l1 - 1, y + 10), clipped to the field.
        let a = k1, b = l + textWidth(s.slice(0, k)) - 1;
        if (a > b) [a, b] = [b, a];
        a = Math.min(a, r.w);
        b = Math.min(b, r.w);
        if (b > a) html += `<i class="mc-selection" style="${at(a, ty - 1, b - a, 11)}"></i><i class="mc-selection blue" style="${at(a, ty - 1, b - a, 11)}"></i>`;
      }
      mirror.innerHTML = html;
    };
    // mouseClicked: the cursor goes to trimStringToWidth(visible text, mouseX - x - 4).
    box.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      field.focus();
      const m = this.mouse(e), s = trimToWidth(drawn().slice(scroll), width);
      const p = trimToWidth(s, m.x - r.x - 4).length + scroll;
      field.setSelectionRange(p, p);
      render();
    });
    field.addEventListener("input", () => {
      // ChatAllowedCharacters.isAllowedCharacter: no section sign, control characters or DEL.
      const clean = field.value.replace(/[§\u0000-\u001f\u007f]/g, "");
      if (clean !== field.value) field.value = clean;
      render();
      input?.(field.value);
    });
    for (const type of ["keyup", "keydown", "select", "focus", "blur"]) field.addEventListener(type, () => requestAnimationFrame(render));
    const onSelection = () => { if (document.activeElement === field) render(); };
    document.addEventListener("selectionchange", onSelection);
    const handle = {
      el: field,
      get value() { return field.value; },
      set value(v) { field.value = v.slice(0, maxLength); scroll = 0; lastText = null; field.setSelectionRange(field.value.length, field.value.length); render(); },
      focus() { field.focus(); render(); },
      show(on) { box.hidden = !on; if (!on && document.activeElement === field) field.blur(); },
      dispose() { document.removeEventListener("selectionchange", onSelection); },
    };
    this.fields.add(handle);
    field.setSelectionRange(field.value.length, field.value.length);
    render();
    if (focus) handle.focus();
    return handle;
  }
  // GuiSlot: the list over options_background tinted 0x202020 (scrolled with the list) between
  // bands tinted 0x404040, 4-unit shadows, the scroll bar at scrollbarX and the selection box.
  // entry(i, y, parent, x) adds slot i's contents at content y; selected(i) marks the box;
  // click(i, double) reports presses (double within 250 ms).
  slotList(spec, { count, entry, selected = () => false, click, scroll = 0 }) {
    const { top, bottom, slotHeight, width: listWidth, scrollbarX } = spec, W = this.w, H = this.h, pad = spec.headerPadding ?? 0;
    const frame = el("div", "mc-slot", at(0, top, W, bottom - top) + `;--top:${top}`);
    const content = el("div", "mc-slot-content", at(0, 4, W, count * slotHeight + pad));
    frame.append(content);
    const track = el("div", "mc-scroll", at(scrollbarX, top, 6, bottom - top)), thumb = el("i");
    track.append(thumb);
    this.layer.prepend(
      frame,
      el("div", "mc-band", at(0, 0, W, top)),
      el("div", "mc-band", at(0, bottom, W, H - bottom) + `;--top:${bottom}`),
      el("div", "mc-shadow top", at(0, top, W, 4)),
      el("div", "mc-shadow bottom", at(0, bottom - 4, W, 4)),
      track,
    );
    // drawSelectionBox: entries at width / 2 - listWidth / 2 + 2.
    const left = Math.trunc(W / 2) - Math.trunc(listWidth / 2), boxes = [];
    for (let i = 0; i < count; i++) {
      const y = pad + i * slotHeight;
      // The selected slot: 0x808080 from y - 2 to y + slotHeight - 2, black inside.
      const box = el("div", "mc-select", at(left, y - 2, listWidth, slotHeight));
      boxes.push(box);
      content.append(box);
      entry(i, y, content, left + 2);
    }
    let amount = 0, lastIndex = -1, lastTime = 0;
    const list = {
      get scroll() { return amount; },
      refresh() { boxes.forEach((b, i) => b.classList.toggle("on", !!selected(i))); },
      set(v) {
        const m = slotMetrics(spec, count, v);
        amount = m.scroll;
        content.style.top = px(4 - Math.trunc(amount));
        frame.style.setProperty("--scroll", String(Math.trunc(amount)));
        track.hidden = m.max <= 0;
        thumb.style.cssText = at(0, m.thumbY - top, 6, m.thumb);
      },
      wheel: (dir) => list.set(amount + (dir * slotHeight) / 2),
    };
    list.refresh();
    list.set(scroll);
    this.list = list;
    // GuiSlot.drawScreen: a press in the list picks the slot under it; dragging then scrolls the
    // list, or the bar scaled to the content.
    const press = (e) => {
      if (e.button !== 0 || e.target.closest(".mc-button")) return;
      const m = this.mouse(e);
      if (m.y < top || m.y > bottom) return;
      e.preventDefault();
      const i = m.x < scrollbarX ? slotAt(spec, W, count, amount, m.x, m.y) : -1;
      if (i >= 0) {
        const now = performance.now(), double = i === lastIndex && now - lastTime < 250;
        lastIndex = i;
        lastTime = now;
        click?.(i, double);
        list.refresh();
      }
      let mult = 1;
      if (m.x >= scrollbarX && m.x <= scrollbarX + 6) {
        const metrics = slotMetrics(spec, count, amount);
        mult = -1 / ((bottom - top - metrics.thumb) / Math.max(1, metrics.max));
      }
      let last = m.y;
      this.drag = { move: (p) => { list.set(amount - (p.y - last) * mult); last = p.y; } };
    };
    frame.addEventListener("pointerdown", press);
    track.addEventListener("pointerdown", press);
    return list;
  }
}

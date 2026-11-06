// DOM widgets for the 1.7.10 menu screens: GuiButton, GuiOptionSlider, GuiTextField and GuiSlot
// drawn from gui/widgets.png and gui/options_background.png at the GUI scale (--u is one scaled
// unit in CSS pixels). Positions come from menu-screens.js. Buttons act on mouse press, as
// GuiScreen.mouseClicked does, and play gui.button.press.
import { textWidth, trimToWidth, splitLines, shadowColor, FORMAT_COLORS, knobOffset, sliderValue, slotMetrics, slotAt, scaledSize } from "./menu-screens.js";
import { Panorama } from "./menu-panorama.js";

const hex = (c) => "#" + (c & 0xffffff).toString(16).padStart(6, "0");
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const px = (n) => `calc(${n}*var(--u))`;
const at = (x, y, w, h) => `left:${px(x)};top:${px(y)}` + (w != null ? `;width:${px(w)}` : "") + (h != null ? `;height:${px(h)}` : "");
// FontRenderer colour runs: a section sign and code switch the colour (r resets). `color` null
// draws the base runs in the widget's own --c / --cs (a button's state colour).
export function textHtml(s, color = 0xffffff) {
  let out = "", run = "", cur = color, under = false;
  const style = (c) => (c == null ? "color:var(--c);--sh:var(--cs)" : `color:${hex(c)};--sh:${hex(shadowColor(c))}`) + (under ? ";text-decoration:underline" : "");
  const flush = () => { if (run) out += `<span style="${style(cur)}">${escapeHtml(run)}</span>`; run = ""; };
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "§" && i + 1 < s.length) {
      flush();
      const code = s[++i].toLowerCase(), k = "0123456789abcdef".indexOf(code);
      // A colour code or reset clears the styles (FontRenderer.renderStringAtPos); §n underlines.
      if (k >= 0) { cur = FORMAT_COLORS[k]; under = false; }
      else if (code === "r") { cur = color; under = false; }
      else if (code === "n") under = true;
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
      this.panorama ??= new Panorama(this.canvas);
      const dpr = Math.min(2, devicePixelRatio || 1);
      this.canvas.width = Math.round(w * this.u * dpr);
      this.canvas.height = Math.round(h * this.u * dpr);
      this.canvas.style.cssText = `width:${px(w)};height:${px(h)}`;
    }
    this.screen.init(this, w, h);
    if (focused) this.layer.querySelector(`.mc-field input[aria-label="${CSS.escape(focused)}"]`)?.focus();
  }
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
    splitLines(s, width).forEach((line, i) => this.text(line, x, y + 9 * i, { color, shadow: false, parent: e }));
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
  field(r, { value = "", maxLength = 32, focus = false, input, label = "" }) {
    const box = el("div", "mc-field", at(r.x - 1, r.y - 1, r.w + 2, r.h + 2));
    const ty = Math.trunc((r.h - 8) / 2), width = r.w - 8;
    const mirror = el("div", "mc-field-draw", at(1, 1, r.w, r.h));
    const field = el("input", "", at(5, ty + 1, width, 8));
    field.type = "text";
    field.maxLength = maxLength;
    field.spellcheck = false;
    field.autocomplete = "off";
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
      const text = field.value, back = field.selectionDirection === "backward";
      const cursor = (back ? field.selectionEnd : field.selectionStart) ?? text.length;
      const end = (back ? field.selectionStart : field.selectionEnd) ?? cursor;
      if (end !== lastEnd || text !== lastText) follow(text, end);
      lastEnd = end;
      lastText = text;
      // drawTextBox, relative to x.
      const l = 4, s = trimToWidth(text.slice(scroll), width), j = cursor - scroll, k = Math.min(end - scroll, s.length);
      const shown = j >= 0 && j <= s.length, bar = cursor < text.length || text.length >= maxLength;
      let html = "", j1 = l;
      const draw = (str, x) => { html += `<div class="mc-text" style="${at(x, ty)}">${textHtml(str, 0xe0e0e0)}</div>`; return x + textWidth(str) + 1; };
      if (s.length) j1 = draw(shown ? s.slice(0, j) : s, l);
      let k1 = j1;
      if (!shown) k1 = j > 0 ? l + r.w : l;
      else if (bar) { k1 = j1 - 1; j1--; }
      if (s.length && shown && j < s.length) draw(s.slice(j), j1);
      if (document.activeElement === field && shown) {
        html += bar ? `<i class="mc-caret" style="${at(k1, ty - 1, 1, 11)}"></i>` : `<div class="mc-text mc-caret" style="${at(k1, ty)}">${textHtml("_", 0xe0e0e0)}</div>`;
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
      const m = this.mouse(e), s = trimToWidth(field.value.slice(scroll), width);
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

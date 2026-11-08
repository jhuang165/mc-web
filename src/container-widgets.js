// Widgets inside the 1.7.10 container screens (batch 24): the GuiContainer slot hover / drag quads and hit region, the GuiRepair cost line
// and name field, the GuiEnchantment option buttons. Geometry and colours are bytecode-read (javap of the unchanged jar) and recorded in
// public/research/container-screens-reference.json "widgets" by tools/verify-container-widgets.mjs; container-widgets.test.js replays them.
// The screens are still DOM: each widget is drawn as positioned glyph text (bitmap-text.js) and sprites cut from the original gui PNGs,
// one GUI unit = var(--u). Slots stay DOM buttons; only their quads and hit region follow the native draw order here.
import { bitmapHtml } from "./bitmap-text.js";
import { textWidth, trimToWidth, shadowColor } from "./menu-screens.js";
import { font } from "./font-renderer.js";
import { GuiTextField } from "./text-field.js";

const u = (n) => `calc(${n}*var(--u))`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
/** An ARGB int as a CSS colour (alpha / 255, four decimals). */
export const argbCss = (argb) => `rgba(${(argb >> 16) & 255},${(argb >> 8) & 255},${argb & 255},${((argb >>> 24) / 255).toFixed(4)})`;

// GuiContainer (bex).
export const SLOT = Object.freeze({ hover: 0x80ffffff | 0, drag: 0x80ffffff | 0, size: 16, hitPad: 1 });
/**
 * GuiContainer.getSlotAtPosition / isPointInRegion(slot.x, slot.y, 16, 16): the first slot in list order whose box padded by 1 on every
 * side holds (x, y) in GUI units relative to guiLeft / guiTop. Slots parked off screen (x < -1000) or disabled never match.
 */
export function slotAt(slots, x, y) {
  for (const s of slots) {
    if (s.x < -1000 || s.enabled === false) continue;
    if (x >= s.x - SLOT.hitPad && x < s.x + SLOT.size + SLOT.hitPad && y >= s.y - SLOT.hitPad && y < s.y + SLOT.size + SLOT.hitPad) return s;
  }
  return null;
}
/**
 * GuiContainer.drawSlot: what a slot shows. While a split drag holds a cursor stack and has exactly one slot, that slot draws nothing
 * (drawSlot returns before the item); with two or more, accepted slots show the share (preview.slots). Otherwise the slot's own stack.
 */
export function slotShown(gui, slot, preview) {
  if (gui.dragging && gui.container?.inv?.cursor && gui.dragSlots?.size === 1 && gui.dragSlots.has(slot)) return null;
  return preview.slots.get(slot) ?? slot.stack;
}

export const ARMOR_ICONS = Object.freeze(["helmet", "chestplate", "leggings", "boots"]);
/**
 * GuiContainer.drawSlot (bex.a(Slot)) as draw ops in paint order, relative to the slot: `rect` (drawRect 0x80FFFFFF), `icon` (the slot's
 * getBackgroundIconIndex, ItemArmor's empty_armor_slot_*), `stack` (renderItemAndEffectIntoGUI + renderItemOverlayIntoGUI: the item, its
 * count, durability bar). A one-slot split drag returns before anything, background icon included (`shown` null). A multi-slot drag target
 * that takes a share paints the rect under its item. The hover quad is drawScreen's: after the slot, over item and count, drawn
 * for the hit-tested slot only (never a disabled one); it is emitted even for a slot drawSlot skipped.
 */
export function slotDrawOps(slot, { gui, preview, hovered = null }) {
  const ops = [], shown = slotShown(gui, slot, preview), hole = !!(gui.dragging && gui.container?.inv?.cursor && gui.dragSlots?.size === 1 && gui.dragSlots.has(slot));
  if (!hole) {
    if (gui.dragging && gui.dragSlots?.size > 1 && gui.dragSlots.has(slot)) ops.push({ kind: "rect", color: SLOT.drag, z: "under" });
    if (shown) ops.push({ kind: "stack", stack: shown, capped: preview.capped?.has(slot) === true });
    else if (slot.type !== undefined && ARMOR_ICONS[slot.type]) ops.push({ kind: "icon", name: ARMOR_ICONS[slot.type] });
  }
  if (hovered === slot && slot.enabled !== false) ops.push({ kind: "rect", color: SLOT.hover, z: "over" });
  return ops;
}
/** The ops as DOM: `stackHtml(stack)` renders the item layers. Empty string for an empty slot. */
export function slotDrawHtml(ops, stackHtml) {
  return ops.map((o) => o.kind === "rect"
    ? `<i class="gui-rect slot-quad ${o.z}" style="left:0;top:0;width:${u(SLOT.size)};height:${u(SLOT.size)};background:${argbCss(o.color)}"></i>`
    : o.kind === "icon" ? `<i class="slot-icon" style="background-image:url('/media/1.7.10/items/empty_armor_slot_${o.name}.png')"></i>`
    : stackHtml(o.stack, o.capped)).join("");
}

// GuiRepair (bey).
export const ANVIL = Object.freeze({
  field: { x: 62, y: 24, width: 103, height: 12, maxLength: 40, color: 0xffffff, disabledColor: 0xffffff },
  cost: { right: 8, y: 67, color: 0x80ff20, unavailable: 0xff6060 },
  nameBackground: { x: 59, y: 20, width: 110, height: 16, vWithInput: 166, vEmpty: 182 },
  error: { x: 99, y: 45, u: 176, v: 0, width: 28, height: 21 },
});
/**
 * GuiRepair.drawGuiContainerForegroundLayer cost line from gui.js anvilCost ({ text, unavailable }): right aligned at xSize - 8, y 67;
 * colour 0x80FF20 or 0xFF6060. Without the unicode flag the shadow is drawString'd three times at (0,+1), (+1,0), (+1,+1) in
 * 0xFF000000 | (colour & 0xFCFCFC) >> 2, then the text; with it, drawRect(x-3, y-2, xSize-7, y+10, black) and (x-2, y-1, xSize-8, y+9,
 * 0xFF3B3B3B) and the text once. Returns null when nothing is drawn.
 */
export function anvilCostDraw(cost, { xSize = 176, unicode = font.unicode, width = textWidth } = {}) {
  if (!cost?.text) return null;
  const color = cost.unavailable ? ANVIL.cost.unavailable : ANVIL.cost.color, x = xSize - ANVIL.cost.right - width(cost.text), y = ANVIL.cost.y;
  const shadow = shadowColor(color);
  if (unicode) return { text: cost.text, color, x, y, copies: [], rects: [[x - 3, y - 2, xSize - 7, y + 10, 0xff000000 | 0], [x - 2, y - 1, xSize - 8, y + 9, 0xff3b3b3b | 0]] };
  return { text: cost.text, color, x, y, copies: [[x, y + 1, shadow], [x + 1, y, shadow], [x + 1, y + 1, shadow]], rects: [] };
}
const glyphs = (text, x, y, color, flat = true) => `<span class="mc-text${flat ? " flat" : ""} gui-glyphs" style="left:${u(x)};top:${u(y)}">${bitmapHtml(text, color)}</span>`;
const rect = ([x0, y0, x1, y1, argb]) => `<i class="gui-rect" style="left:${u(x0)};top:${u(y0)};width:${u(x1 - x0)};height:${u(y1 - y0)};background:${argbCss(argb)}"></i>`;
export function anvilCostHtml(cost, opts) {
  const d = anvilCostDraw(cost, opts);
  if (!d) return "";
  return d.rects.map(rect).join("") + d.copies.map(([x, y, c]) => glyphs(d.text, x, y, c)).join("") + glyphs(d.text, d.x, d.y, d.color);
}

/**
 * GuiTextField.setSelectionPos: the lineScrollOffset that keeps `pos` in view (`width` is getWidth(): the field width without a background,
 * width - 8 with one). trimStringToWidth(text, width, true) is the trailing run that fits.
 */
export function followScroll(text, pos, scroll, width, measure = textWidth) {
  const fits = (s) => { let w = 0, i = 0; for (; i < s.length; i++) { w += measure(s[i]); if (w > width) break; } return i; };
  const tail = (s) => { let w = 0, i = s.length; while (i > 0 && (w += measure(s[i - 1])) <= width) i--; return s.length - i; };
  if (scroll > text.length) scroll = text.length;
  const l = fits(text.slice(scroll)) + scroll;
  if (pos === scroll) scroll -= tail(text);
  if (pos > l) scroll += pos - l;
  else if (pos <= scroll) scroll -= scroll - pos;
  return Math.max(0, Math.min(scroll, text.length));
}
/**
 * GuiTextField.drawTextBox for a field without a background (GuiRepair: setEnableBackgroundDrawing(false)), relative to the field's x / y:
 * the visible run trimmed to `width` from `scroll`, drawStringWithShadow (end x = x + width + 1), the caret as a 1 x 11 0xFFD0D0D0 bar
 * inside the text or at the length limit, else "_", and the selection box. Returns draw items; the 6-tick blink is the CSS mc-caret.
 */
export function textFieldDraw({ text, cursor, selEnd = cursor, scroll = 0, width, maxLength, focused, color = 0xffffff }, measure = textWidth) {
  const s = trimToWidth(text.slice(scroll), width), j = cursor - scroll, k = Math.min(selEnd - scroll, s.length);
  const shown = j >= 0 && j <= s.length, bar = cursor < text.length || text.length >= maxLength, out = [];
  let j1 = 0;
  if (s.length) { const head = shown ? s.slice(0, j) : s; out.push({ kind: "text", text: head, x: 0, color }); j1 = measure(head) + 1; }
  let k1 = j1;
  if (!shown) k1 = j > 0 ? width : 0;
  else if (bar) { k1 = j1 - 1; j1--; }
  if (s.length && shown && j < s.length) out.push({ kind: "text", text: s.slice(j), x: j1, color });
  if (focused && shown) out.push(bar ? { kind: "bar", x: k1, y: -1, width: 1, height: 11, color: 0xffd0d0d0 | 0 } : { kind: "text", text: "_", x: k1, color, caret: true });
  if (k !== j) {
    let a = k1, b = measure(s.slice(0, k)) - 1;
    if (a > b) [a, b] = [b, a];
    a = Math.min(a, width); b = Math.min(b, width);
    if (b > a) out.push({ kind: "selection", x: a, y: -1, width: b - a, height: 11 });
  }
  return out;
}
export function textFieldHtml(items) {
  return items.map((d) =>
    d.kind === "text" ? `<span class="mc-text gui-glyphs${d.caret ? " mc-caret" : ""}" style="left:${u(d.x)};top:0">${bitmapHtml(d.text, d.color)}</span>`
    : d.kind === "bar" ? `<i class="gui-rect mc-caret" style="left:${u(d.x)};top:${u(d.y)};width:${u(d.width)};height:${u(d.height)};background:${argbCss(d.color)}"></i>`
    : `<i class="mc-selection gui-rect" style="left:${u(d.x)};top:${u(d.y)};width:${u(d.width)};height:${u(d.height)}"></i><i class="mc-selection blue gui-rect" style="left:${u(d.x)};top:${u(d.y)};width:${u(d.width)};height:${u(d.height)}"></i>`).join("");
}
/** The anvil decorations: name field background, the typing <input> (transparent; the glyphs are drawn beside it), cost line, red cross. */
export function anvilDecorationsHtml() {
  const f = ANVIL.field;
  return '<i class="anvil-name-background" id="anvil-name-background"></i>'
    + `<input id="anvil-name" aria-label="Item name" maxlength="${f.maxLength}" autocomplete="off" spellcheck="false" disabled>`
    + `<div class="anvil-name-draw" id="anvil-name-draw" aria-hidden="true"></div>`
    + '<div id="anvil-cost" class="anvil-cost" aria-live="polite"></div><i class="anvil-error" id="anvil-error" hidden></i>';
}
/** GuiTextField.mouseClicked on a focused field: the cursor goes after the visible characters that fit left of the pointer. */
export function fieldClickCursor(text, scroll, relX, width) {
  const visible = trimToWidth(text.slice(scroll), width);
  return (relX < 0 ? 0 : trimToWidth(visible, relX).length) + scroll;
}
const fieldState = new WeakMap();
const mac = () => typeof navigator !== "undefined" && /Mac/i.test(navigator.platform ?? "");
/** Mirrors the GuiTextField model into the (transparent) <input> so assistive tech and the browser's own state agree with it. */
function syncInput(field, m) {
  if (field.value !== m.text) field.value = m.text;
  const a = Math.min(m.cursor, m.selectionEnd), b = Math.max(m.cursor, m.selectionEnd);
  if (field.selectionStart !== a || field.selectionEnd !== b) field.setSelectionRange(a, b, m.selectionEnd < m.cursor ? "backward" : "forward");
}
/**
 * The anvil name field's input: every key goes through GuiTextField.textboxKeyTyped (text-field.js) and the model, not the browser's own
 * editing; copy / cut / paste events supply GuiScreen.get/setClipboardString. A plain pointer press calls mouseClicked (cursor by glyph
 * widths). The <input> only receives focus and mirrors the model.
 */
function attachAnvilField(field, state) {
  const m = (state.model = new GuiTextField({ maxLength: ANVIL.field.maxLength, text: field.value, enabled: !field.disabled, focused: false }));
  const changed = (before) => { syncInput(field, m); if (m.text !== before) field.dispatchEvent(new Event("input", { bubbles: true })); };
  field.addEventListener("focus", () => { m.focused = true; });
  field.addEventListener("blur", () => { m.focused = false; });
  field.addEventListener("keydown", (e) => {
    if (e.isComposing || e.altKey) return;
    m.enabled = !field.disabled;
    const before = m.text, k = e.key.length === 1 && (e.ctrlKey || e.metaKey) ? e.key.toLowerCase() : "";
    if (k === "c" || k === "v" || k === "x") return; // completed by the copy / cut / paste events below, which carry the data
    if (m.keyTyped({ key: e.key, ctrl: e.ctrlKey, shift: e.shiftKey, meta: e.metaKey }, { mac: mac() })) { e.preventDefault(); changed(before); }
  });
  const clip = (e, cut) => {
    m.enabled = !field.disabled;
    const before = m.text;
    e.clipboardData?.setData("text/plain", m.selectedText());
    if (cut && m.enabled) m.writeText("");
    e.preventDefault(); changed(before);
  };
  field.addEventListener("copy", (e) => clip(e, false));
  field.addEventListener("cut", (e) => clip(e, true));
  field.addEventListener("paste", (e) => {
    e.preventDefault();
    const before = m.text;
    if (!field.disabled) m.writeText(e.clipboardData?.getData("text/plain") ?? "");
    changed(before);
  });
  // Virtual keyboards deliver text without usable keydown keys: take the input's own edit.
  field.addEventListener("input", (e) => {
    if (e.isTrusted === false) return;
    const value = [...field.value].filter((c) => c !== "\u00a7" && c.charCodeAt(0) >= 32 && c !== "\u007f").join("").slice(0, ANVIL.field.maxLength), at = field.selectionEnd ?? value.length;
    m.text = value; m.setCursorPosition(at); syncInput(field, m);
  });
  // GuiTextField.mouseClicked: no native text drag selection; focus the input and move the cursor by FontRenderer widths.
  field.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (field.disabled) return;
    field.focus();
    const box = field.getBoundingClientRect(), relX = Math.floor((e.clientX - box.left) / (box.width / ANVIL.field.width));
    m.setCursorPosition(fieldClickCursor(m.text, state.scroll ?? 0, relX, ANVIL.field.width));
    syncInput(field, m);
  });
}
/** Per frame: the background row, the red cross, the field glyphs and the cost line. `container` is anvil-container.js AnvilContainer. */
export function refreshAnvil(root, container, cost) {
  const left = container.inputs.getStack(0), right = container.inputs.getStack(1), field = root.querySelector("#anvil-name");
  if (!field) return;
  let state = fieldState.get(field);
  if (!state) { fieldState.set(field, (state = {})); attachAnvilField(field, state); }
  const m = state.model;
  field.disabled = !left;
  m.enabled = !!left;
  if (field.value !== m.text) { m.setText(field.value); } // GuiTextField.setText: the screen replaced the text, cursor at the end
  root.querySelector("#anvil-name-background")?.classList.toggle("active", !!left);
  root.querySelector("#anvil-error").hidden = !(left || right) || !!container.output;
  const costEl = root.querySelector("#anvil-cost"), costHtml = anvilCostHtml(cost);
  if (costEl.dataset.html !== costHtml) { costEl.dataset.html = costHtml; costEl.innerHTML = costHtml; costEl.setAttribute("aria-label", cost.text); }
  const text = m.text, focused = root.ownerDocument.activeElement === field && m.focused, cursor = m.cursor, end = m.selectionEnd;
  if (state.text !== text || state.end !== end) state.scroll = followScroll(text, end, state.scroll ?? 0, ANVIL.field.width);
  state.text = text; state.end = end;
  const html = textFieldHtml(textFieldDraw({ text, cursor, selEnd: end, scroll: state.scroll, width: ANVIL.field.width, maxLength: ANVIL.field.maxLength, focused, color: left ? ANVIL.field.color : ANVIL.field.disabledColor }));
  const draw = root.querySelector("#anvil-name-draw");
  if (draw.dataset.html !== html) { draw.dataset.html = html; draw.innerHTML = html; }
}

// GuiMerchant.MerchantButton (bfw) drawButton: villager.png at u 176 (+ width when the pointer is inside and enabled, + 2 x width when
// disabled), v 0 for the next arrow and 19 for the previous one; hovered is the Gui hit test x >= button.x && < button.x + 12.
export const MERCHANT_ARROW = Object.freeze({ width: 12, height: 19, u: 176, next: { x: 147, y: 23, v: 0 }, previous: { x: 17, y: 23, v: 19 } });
export function merchantArrowDraw(which, { enabled, mouseX = -1, mouseY = -1 }) {
  const a = MERCHANT_ARROW, b = a[which];
  const hover = mouseX >= b.x && mouseY >= b.y && mouseX < b.x + a.width && mouseY < b.y + a.height;
  return { hover, u: a.u + (!enabled ? a.width * 2 : hover ? a.width : 0), v: b.v };
}

// GuiEnchantment (bfq).
export const ENCHANT = Object.freeze({
  button: { x: 60, y: 14, pitch: 19, width: 108, height: 19 },
  v: { off: 185, poor: 185, hover: 204, normal: 166 },
  name: { dx: 2, dy: 2, width: 104, color: 0x685e4a, hover: 0xffff80 },
  level: { right: 106, dy: 9, color: 0x80ff20, poor: 0x407f10 },
});
/** The galactic name colour for a poor option: (0x685E4A & 0xFEFEFE) >> 1. */
export const poorNameColor = (c = ENCHANT.name.color) => (c & 0xfefefe) >> 1;
/**
 * GuiEnchantment.drawGuiContainerBackgroundLayer for option i: level 0 is the bare v 185 row; experienceLevel < level outside Creative is
 * v 185 with the darkened name and 0x407F10 level; otherwise v 204 under the mouse (name 0xFFFF80) or v 166, level 0x80FF20. The level is
 * drawStringWithShadow'd right aligned at x 106, y 9 of the row; the name drawSplitString'd at (2, 2), 104 wide.
 */
export function enchantOptionDraw(i, { level, xpLevel, creative, mouseX = -1, mouseY = -1 }, width = textWidth) {
  const b = ENCHANT.button, top = b.y + b.pitch * i;
  if (!level) return { state: "off", x: b.x, y: top, v: ENCHANT.v.off, name: null, level: null };
  const text = String(level), lvl = (color) => ({ text, x: ENCHANT.level.right - width(text), y: ENCHANT.level.dy, color });
  if (xpLevel < level && !creative) return { state: "poor", x: b.x, y: top, v: ENCHANT.v.poor, name: poorNameColor(), level: lvl(ENCHANT.level.poor) };
  const mx = mouseX - b.x, my = mouseY - top, over = mx >= 0 && my >= 0 && mx < b.width && my < b.height;
  return { state: over ? "hover" : "on", x: b.x, y: top, v: over ? ENCHANT.v.hover : ENCHANT.v.normal, name: over ? ENCHANT.name.hover : ENCHANT.name.color, level: lvl(ENCHANT.level.color) };
}
export function enchantDecorationsHtml() {
  return [0, 1, 2].map((i) => `<button class="enchant-option off" data-enchant-option="${i}" style="top:${u(ENCHANT.button.y + ENCHANT.button.pitch * i)}" aria-label="Enchantment option ${i + 1}"><i class="enchant-name"></i><span class="enchant-level"></span></button>`).join("")
    + '<span class="enchant-shelves" id="enchant-shelves" aria-live="polite"></span>';
}
const hexCss = (c) => "#" + (c & 0xffffff).toString(16).padStart(6, "0");
/** Per frame for the three options; `mouse` is the pointer in GUI units relative to guiLeft / guiTop. */
export function refreshEnchantOptions(root, levels, { xpLevel, creative, mouseX, mouseY }) {
  for (const b of root.querySelectorAll("[data-enchant-option]")) {
    const i = +b.dataset.enchantOption, d = enchantOptionDraw(i, { level: levels[i], xpLevel, creative, mouseX, mouseY });
    b.className = `enchant-option ${d.state}`;
    b.style.backgroundPositionY = u(-d.v);
    b.setAttribute("aria-disabled", String(d.state === "off" || d.state === "poor"));
    b.setAttribute("aria-label", levels[i] ? `Enchantment option ${i + 1}: level ${levels[i]}${d.state === "poor" ? " (not enough experience levels)" : ""}` : `Enchantment option ${i + 1}: unavailable`);
    const name = b.querySelector(".enchant-name");
    if (name) name.style.background = d.name == null ? "transparent" : hexCss(d.name);
    const lv = b.querySelector(".enchant-level"), html = d.level ? glyphs(d.level.text, d.level.x, d.level.y, d.level.color, false) : "";
    if (lv && lv.dataset.html !== html) { lv.dataset.html = html; lv.innerHTML = html; }
  }
}
export { esc as escapeAttr };

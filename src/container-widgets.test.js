// Replays the bytecode-read widget geometry (public/research/container-widgets-reference.json, tools/verify-container-widgets.mjs)
// against container-widgets.js, pyramid-gui.js and book-ui.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SLOT, ANVIL, MERCHANT_ARROW, merchantArrowDraw, slotDrawOps, slotDrawHtml, ENCHANT, argbCss, slotAt, slotShown, anvilCostDraw, anvilCostHtml, followScroll, textFieldDraw, fieldClickCursor, enchantOptionDraw, enchantDecorationsHtml, anvilDecorationsHtml, poorNameColor } from './container-widgets.js';
import { beaconTooltip, beaconButtonDraw, beaconUiHtml, powerButtons, BEACON_CONFIRM, BEACON_CANCEL } from './pyramid-gui.js';
import { bookScreenWidth } from './book-ui.js';
import { GuiTextField } from './text-field.js';

const W = JSON.parse(readFileSync(new URL('../public/research/container-widgets-reference.json', import.meta.url), 'utf8')).widgets;
const css = readFileSync(new URL('./container-ui.css', import.meta.url), 'utf8');
const width = (s) => 6 * s.length; // a fixed-advance stand-in for FontRenderer.getStringWidth

test('slot quads: 0x80FFFFFF hover over the item, drag under it, hit region padded by 1', () => {
  assert.equal(SLOT.hover, W.slot.hover.argb);
  assert.equal(SLOT.drag, W.slot.drag.argb);
  assert.equal(SLOT.hitPad, W.slot.hitPad);
  assert.equal(argbCss(SLOT.hover), 'rgba(255,255,255,0.5020)');
  assert.doesNotMatch(css, /container-slot\.hovered|container-slot\.dragged|container-slot[^{]*:hover/); // quads come from the draw plan, not CSS
  const slots = [{ x: 8, y: 84 }, { x: 26, y: 84 }, { x: -2000, y: 0 }, { x: 44, y: 84, enabled: false }];
  assert.equal(slotAt(slots, 7, 83), slots[0]);
  assert.equal(slotAt(slots, 24, 100), slots[0]); // x + 16 is still inside the padded box
  assert.equal(slotAt(slots, 25, 90), slots[1]); // the first match in list order
  assert.equal(slotAt(slots, 6, 90), null);
  assert.equal(slotAt(slots, 50, 90), null); // disabled
  const a = { stack: { id: 1, count: 4 } }, b = { stack: null }, preview = { slots: new Map([[b, { id: 1, count: 2 }]]) };
  const gui = { dragging: true, container: { inv: { cursor: { id: 1, count: 4 } } }, dragSlots: new Set([a]) };
  assert.equal(slotShown(gui, a, preview), null); // one dragged slot draws nothing
  gui.dragSlots.add(b);
  assert.equal(slotShown(gui, a, preview), a.stack);
  assert.deepEqual(slotShown(gui, b, preview), { id: 1, count: 2 });
});

test('anvil: field box, cost line copies, unicode rects and the red cross', () => {
  const f = W.anvil.field;
  assert.deepEqual([ANVIL.field.x, ANVIL.field.y, ANVIL.field.width, ANVIL.field.height, ANVIL.field.maxLength], [f.x, f.y, f.width, f.height, f.maxLength]);
  assert.equal(ANVIL.field.color | 0xff000000, f.textColor);
  assert.equal(ANVIL.cost.color, W.anvil.cost.color);
  assert.equal(ANVIL.cost.unavailable, W.anvil.cost.tooExpensiveColor);
  assert.equal(ANVIL.cost.y, W.anvil.cost.y);
  assert.deepEqual(ANVIL.nameBackground, (({ x, y, width, height, vWithInput, vEmpty }) => ({ x, y, width, height, vWithInput, vEmpty }))(W.anvil.nameBackground));
  assert.deepEqual(ANVIL.error, (({ x, y, u, v, width, height }) => ({ x, y, u, v, width, height }))(W.anvil.error));
  const cost = { text: 'Enchantment Cost: 5', unavailable: false }, d = anvilCostDraw(cost, { unicode: false, width });
  assert.equal(d.x, 176 - 8 - width(cost.text));
  assert.deepEqual(d.copies.map(([x, y]) => [x - d.x, y - d.y]), W.anvil.cost.copies);
  assert.equal(d.copies[0][2], (W.anvil.cost.color & W.anvil.cost.shadowMask) >> W.anvil.cost.shadowShift);
  const red = anvilCostDraw({ text: 'Too Expensive!', unavailable: true }, { unicode: true, width });
  assert.equal(red.color, 0xff6060);
  assert.deepEqual(red.copies, []);
  assert.deepEqual(red.rects.map(([x0, y0, x1, y1, c]) => ({ dx0: x0 - red.x, dy0: y0 - red.y, xSizeLess: 176 - x1, dy1: y1 - red.y, color: c })), W.anvil.cost.unicodeRects);
  assert.equal(anvilCostDraw({ text: '' }), null);
  assert.equal((anvilCostHtml(cost, { unicode: false, width }).match(/gui-glyphs/g) ?? []).length, 4);
  const html = anvilDecorationsHtml();
  assert.match(html, /maxlength="40"/);
  assert.match(html, /id="anvil-name-draw"/);
});

test('anvil field: GuiTextField drawTextBox without a background', () => {
  // The cursor at the end and under the limit: the text then "_" at the end x (drawStringWithShadow returns x + width + 1).
  let items = textFieldDraw({ text: 'Sword', cursor: 5, width: 103, maxLength: 40, focused: true }, width);
  assert.deepEqual(items.map((i) => [i.kind, i.text, i.x]), [['text', 'Sword', 0], ['text', '_', 31]]);
  // Inside the text: a 1 x 11 0xFFD0D0D0 bar from y - 1 at the end of the head.
  items = textFieldDraw({ text: 'Sword', cursor: 2, width: 103, maxLength: 40, focused: true }, width);
  const bar = items.find((i) => i.kind === 'bar');
  assert.deepEqual([bar.x, bar.y, bar.width, bar.height, bar.color], [12, -1, 1, 11, W.anvil.field.cursorBar]);
  assert.equal(items.find((i) => i.text === 'ord').x, 12);
  // Unfocused: no caret.
  assert.deepEqual(textFieldDraw({ text: 'Sword', cursor: 5, width: 103, maxLength: 40, focused: false }, width).map((i) => i.kind), ['text']);
  // Selection box from the cursor to the selection end.
  items = textFieldDraw({ text: 'Sword', cursor: 5, selEnd: 1, width: 103, maxLength: 40, focused: true }, width);
  assert.ok(items.some((i) => i.kind === 'selection'));
  // Scrolling keeps the cursor in view; clicks place the cursor by glyph widths.
  assert.equal(followScroll('a'.repeat(40), 40, 0, 103, () => 6), 40 - 17);
  assert.equal(fieldClickCursor('abcdef', 0, 13, 103), 2);
});

test('enchanting: three 108 x 19 rows, no icons, glyph level at x 106 - width, y 9', () => {
  assert.deepEqual(ENCHANT.button, (({ x, y, pitch, width, height }) => ({ x, y, pitch, width, height }))(W.enchanting.button));
  assert.deepEqual(ENCHANT.v, W.enchanting.v);
  assert.deepEqual([ENCHANT.name.dx, ENCHANT.name.dy, ENCHANT.name.width, ENCHANT.name.color, ENCHANT.name.hover], [W.enchanting.name.dx, W.enchanting.name.dy, W.enchanting.name.width, W.enchanting.name.color, W.enchanting.name.hoverColor]);
  assert.equal(poorNameColor(), (W.enchanting.name.color & W.enchanting.name.poorColorMask) >> W.enchanting.name.poorColorShift);
  assert.deepEqual([ENCHANT.level.right, ENCHANT.level.dy, ENCHANT.level.color, ENCHANT.level.poor], [W.enchanting.level.right, W.enchanting.level.dy, W.enchanting.level.color, W.enchanting.level.poorColor]);
  assert.equal(enchantOptionDraw(0, { level: 0, xpLevel: 30 }, width).v, 185);
  const poor = enchantOptionDraw(1, { level: 12, xpLevel: 3, creative: false }, width);
  assert.deepEqual([poor.state, poor.v, poor.level.x, poor.level.y, poor.level.color], ['poor', 185, 106 - 12, 9, 0x407f10]);
  assert.equal(enchantOptionDraw(1, { level: 12, xpLevel: 3, creative: true }, width).state, 'on');
  const hover = enchantOptionDraw(2, { level: 30, xpLevel: 30, mouseX: 60, mouseY: 14 + 38 }, width);
  assert.deepEqual([hover.state, hover.v, hover.name], ['hover', 204, 0xffff80]);
  assert.equal(enchantOptionDraw(2, { level: 30, xpLevel: 30, mouseX: 168, mouseY: 52 }, width).state, 'on'); // x 60 + 108 is outside
  assert.doesNotMatch(enchantDecorationsHtml(), /enchant-icon/);
  assert.doesNotMatch(css, /\.enchant-icon/);
});

test('beacon: tooltips by 22 x 22 hit test, disabled buttons included', () => {
  assert.deepEqual([BEACON_CONFIRM.x, BEACON_CONFIRM.y, BEACON_CANCEL.x, BEACON_CANCEL.y], [W.beacon.confirm.x, W.beacon.confirm.y, W.beacon.cancel.x, W.beacon.cancel.y]);
  const speed = powerButtons(1)[0];
  assert.equal(beaconTooltip(speed.x, speed.y, { levels: 1, primary: 0 }), 'Speed');
  assert.equal(beaconTooltip(speed.x + 24, speed.y, { levels: 1, primary: 0 }), 'Haste');
  const strength = powerButtons(1).find((b) => b.tier === 2);
  assert.ok(strength.disabled);
  assert.equal(beaconTooltip(strength.x + 1, strength.y + 1, { levels: 1, primary: 0 }), 'Strength');
  assert.equal(beaconTooltip(167 - 23 + 1, 48, { levels: 4, primary: 1 }), 'Regeneration');
  assert.equal(beaconTooltip(167 + 1 + 1, 48, { levels: 4, primary: 1 }), 'Speed II');
  assert.equal(beaconTooltip(164, 107, { levels: 4, primary: 1 }), 'Done');
  assert.equal(beaconTooltip(211, 128, { levels: 4, primary: 1 }), 'Cancel');
  assert.equal(beaconTooltip(212, 129, { levels: 4, primary: 1 }), null);
  assert.equal(beaconTooltip(164, 107, { levels: -1, primary: 0 }), null);
});

test('book: laid out on the ScaledResolution width, not a fixed 320', () => {
  assert.equal(W.book.width, 192);
  assert.equal(bookScreenWidth(1280, 720, 2), 640);
  assert.equal(bookScreenWidth(1281, 720, 2), 641);
  assert.equal(bookScreenWidth(854, 480, 2), 427);
});

test('GuiContainer.drawSlot plan: item, armour icon, one-slot drag hole, drag quad under, hover quad over', () => {
  const stack = { id: 1, count: 3 }, item = { stack }, armour = { stack: null, type: 1 }, plain = { stack: null };
  const preview = { slots: new Map(), capped: new Set() }, idle = { dragging: false, dragSlots: new Set(), container: { inv: {} } };
  assert.deepEqual(slotDrawOps(item, { gui: idle, preview }).map((o) => o.kind), ['stack']);
  assert.deepEqual(slotDrawOps(armour, { gui: idle, preview }), [{ kind: 'icon', name: 'chestplate' }]);
  assert.deepEqual(slotDrawOps(plain, { gui: idle, preview }), []);
  // hover quad after the item, only for the hit-tested slot, never a disabled one
  assert.deepEqual(slotDrawOps(item, { gui: idle, preview, hovered: item }).map((o) => o.kind + (o.z ?? '')), ['stack', 'rectover']);
  assert.deepEqual(slotDrawOps({ ...item, enabled: false }, { gui: idle, preview, hovered: item }).length, 1);
  // a one-slot split drag: drawSlot returns first (no item, no armour icon) but drawScreen still draws the hover quad
  const cursor = { id: 2, count: 8 }, one = { dragging: true, dragSlots: new Set([armour]), container: { inv: { cursor } } };
  assert.deepEqual(slotDrawOps(armour, { gui: one, preview }), []);
  assert.deepEqual(slotDrawOps(armour, { gui: one, preview, hovered: armour }).map((o) => o.kind), ['rect']);
  one.dragSlots.add(plain); // two or more: the share previews, the quad lies under the item
  assert.deepEqual(slotDrawOps(armour, { gui: one, preview }).map((o) => o.kind + (o.z ?? '')), ['rectunder', 'icon']);
  const html = slotDrawHtml(slotDrawOps(item, { gui: idle, preview, hovered: item }), (st) => `<b>${st.id}</b>`);
  assert.match(html, /^<b>1<\/b><i class="gui-rect slot-quad over"[^>]*rgba\(255,255,255,0\.5020\)/);
  assert.match(css, /\.slot-quad\.under\{z-index:-1\}[^}]*\.slot-quad\.over\{z-index:6\}/);
});

test('GuiMerchant arrows: sprite column from enabled + Gui hit test (bfw)', () => {
  const m = MERCHANT_ARROW, base = { enabled: true };
  assert.deepEqual([m.width, m.height, m.u], [12, 19, 176]);
  assert.deepEqual(merchantArrowDraw('next', { ...base, mouseX: 0, mouseY: 0 }), { hover: false, u: 176, v: 0 });
  assert.deepEqual(merchantArrowDraw('next', { ...base, mouseX: 147, mouseY: 23 }), { hover: true, u: 188, v: 0 });
  assert.equal(merchantArrowDraw('next', { ...base, mouseX: 159, mouseY: 30 }).hover, false); // x < 147 + 12
  assert.equal(merchantArrowDraw('previous', { ...base, mouseX: 28, mouseY: 41 }).hover, true);
  assert.equal(merchantArrowDraw('previous', { ...base, mouseX: 28, mouseY: 42 }).hover, false);
  assert.deepEqual(merchantArrowDraw('previous', { enabled: false, mouseX: 20, mouseY: 30 }), { hover: true, u: 200, v: 19 }); // disabled wins
  assert.doesNotMatch(css, /merchant-step[^{]*:hover/);
});

test('GuiBeacon buttons (bfd): disabled 44, selected 22, hover 66; icon never dimmed', () => {
  const b = { x: 50, y: 22, disabled: false };
  assert.deepEqual(beaconButtonDraw(b, false, 0, 0), { hover: false, u: 0 });
  assert.deepEqual(beaconButtonDraw(b, false, 71, 43), { hover: true, u: 66 });
  assert.equal(beaconButtonDraw(b, false, 72, 43).hover, false);
  assert.equal(beaconButtonDraw(b, true, 60, 30).u, 22); // selected beats hover
  assert.deepEqual(beaconButtonDraw({ ...b, disabled: true }, true, 60, 30), { hover: true, u: 44 }); // disabled beats both, and still reports the hit
  assert.doesNotMatch(css, /beacon-btn[^{]*:hover|beacon-btn\.off \.beacon-effect\{/);
  const p = powerButtons(1)[0], html = (x, y) => beaconUiHtml({ levels: 1, primary: 0, secondary: 0, payment: false, icon: () => '', mouseX: x, mouseY: y });
  assert.match(html(p.x + 1, p.y + 1), new RegExp(`left:calc\\(${p.x}\\*var\\(--u\\)\\);top:calc\\(${p.y}\\*var\\(--u\\)\\);--su:66`));
  assert.doesNotMatch(html(-1, -1), /--su:66/);
});

test('GuiTextField.textboxKeyTyped: selection, word jumps, deletes, clipboard keys', () => {
  const f = (text = 'iron sword  fire', opts) => new GuiTextField({ maxLength: 20, text, ...opts });
  const key = (field, k, mods = {}, o = {}) => field.keyTyped({ key: k, ...mods }, o);
  let t = f();
  assert.equal(key(t, 'x', { ctrl: false }), true); assert.equal(t.text, 'iron sword  firex');
  t = f(); key(t, 'ArrowLeft', { ctrl: true }); assert.equal(t.cursor, 12); // word start
  key(t, 'ArrowLeft', { ctrl: true }); assert.equal(t.cursor, 5);
  key(t, 'ArrowRight', { ctrl: true }); assert.equal(t.cursor, 12); // past the word's trailing spaces
  key(t, 'ArrowRight', { ctrl: true }); assert.equal(t.cursor, 16);
  t = f(); key(t, 'ArrowLeft', { shift: true }); key(t, 'ArrowLeft', { shift: true });
  assert.deepEqual([t.cursor, t.selectionEnd, t.selectedText()], [16, 14, 're']);
  key(t, 'ArrowLeft', { shift: true, ctrl: true }); assert.equal(t.selectionEnd, 12);
  key(t, 'Home', { shift: true }); assert.equal(t.selectionEnd, 0);
  key(t, 'x'); assert.equal(t.text, 'x'); // typing replaces the selection
  t = f(); key(t, 'Backspace', { ctrl: true }); assert.equal(t.text, 'iron sword  '); // deleteWords(-1)
  key(t, 'Backspace', { ctrl: true }); assert.equal(t.text, 'iron ');
  t = f(); key(t, 'Home'); key(t, 'Delete', { ctrl: true }); assert.equal(t.text, 'sword  fire'); // deleteWords(1) skips the spaces
  key(t, 'Delete'); assert.equal(t.text, 'word  fire');
  key(t, 'End', { shift: true }); assert.equal(t.selectedText(), 'word  fire');
  key(t, 'Backspace'); assert.equal(t.text, ''); // a selection is deleted whole
  // ctrl+A, C, V, X; Command also works for the word keys (native: Command on a Mac, Control elsewhere)
  let clip = '';
  const clipboard = { read: () => clip, write: (s) => { clip = s; } };
  t = f('abc def'); key(t, 'a', { ctrl: true }); assert.equal(t.selectedText(), 'abc def');
  key(t, 'c', { ctrl: true }, { clipboard }); assert.equal(clip, 'abc def');
  key(t, 'x', { ctrl: true }, { clipboard }); assert.equal(t.text, '');
  key(t, 'v', { ctrl: true }, { clipboard }); assert.equal(t.text, 'abc def');
  t = f('abc def'); key(t, 'ArrowLeft', { meta: true }, { mac: true }); assert.equal(t.cursor, 4);
  key(t, 'ArrowLeft', { ctrl: true }, { mac: true }); assert.equal(t.cursor, 0); // Control also jumps words
  // length limit, ChatAllowedCharacters filter, disabled and unfocused fields
  t = f('', { maxLength: 4 }); t.writeText('ab\u00a7c\ndefg'); assert.equal(t.text, 'abcd');
  t = f('x', { enabled: false }); key(t, 'y'); key(t, 'Backspace'); assert.equal(t.text, 'x');
  t = f('x', { focused: false }); assert.equal(key(t, 'y'), false);
  assert.equal(f().keyTyped({ key: 'F5' }), false);
});

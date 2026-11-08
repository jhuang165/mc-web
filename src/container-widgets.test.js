// Replays the bytecode-read widget geometry (public/research/container-widgets-reference.json, tools/verify-container-widgets.mjs)
// against container-widgets.js, pyramid-gui.js and book-ui.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SLOT, ANVIL, ENCHANT, argbCss, slotAt, slotShown, anvilCostDraw, anvilCostHtml, followScroll, textFieldDraw, fieldClickCursor, enchantOptionDraw, enchantDecorationsHtml, anvilDecorationsHtml, poorNameColor } from './container-widgets.js';
import { beaconTooltip, powerButtons, BEACON_CONFIRM, BEACON_CANCEL } from './pyramid-gui.js';
import { bookScreenWidth } from './book-ui.js';

const W = JSON.parse(readFileSync(new URL('../public/research/container-widgets-reference.json', import.meta.url), 'utf8')).widgets;
const css = readFileSync(new URL('./container-ui.css', import.meta.url), 'utf8');
const width = (s) => 6 * s.length; // a fixed-advance stand-in for FontRenderer.getStringWidth

test('slot quads: 0x80FFFFFF hover over the item, drag under it, hit region padded by 1', () => {
  assert.equal(SLOT.hover, W.slot.hover.argb);
  assert.equal(SLOT.drag, W.slot.drag.argb);
  assert.equal(SLOT.hitPad, W.slot.hitPad);
  assert.equal(argbCss(SLOT.hover), 'rgba(255,255,255,0.5020)');
  assert.match(css, /\.container-slot\.hovered:after\{[^}]*background:rgba\(255,255,255,0\.502\)[^}]*z-index:6/);
  assert.match(css, /\.container-slot\.dragged\{background:rgba\(255,255,255,0\.502\)!important\}/);
  assert.doesNotMatch(css, /\.container-slot\.dragged:after/);
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

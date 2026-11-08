// Book and Quill / Written Book against public/research/book-reference.json (tools/verify-book.mjs; unchanged 1.7.10 classes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ITEM_WRITABLE_BOOK as WRITABLE, ITEM_WRITTEN_BOOK as WRITTEN, validWritable, validWritten, bookDisplayName, bookInfoLines, charWidth, stringWidth,
  listFormatted, splitStringHeight, bookCloneResult, applyBookEdit, applyBookSign, BookScreen, isAllowedCharacter, LIMITS, pageIndicator,
} from './books.js';
import { ITEMS, craftingResult, SHAPELESS } from './survival.js';
import { ORIGINAL_ITEMS } from './original-items.js';
import { makeStack, copyStack, sameStackItem, PlayerInventory } from './inventory.js';
import { stackName, liveNativeName } from './item-names.js';
import { tooltipLines, withGlint } from './gui.js';
import { CREATIVE_TABS } from './creative.js';
import { writeContainerTile } from './region-export.js';
import { readContainerTile } from './region-import.js';
import { NBT } from './nbt.js';
import { createCommandRunner } from './commands.js';
import { createCommandHost } from './command-host.js';
import { chat } from './chat-ui.js';
import { World } from './world.js';
import { Survival } from './survival.js';
import { Weather } from './weather.js';
import { Experience } from './experience.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/book-reference.json', import.meta.url)));
const live = (id) => (id === 340 ? 314 : id === 351 ? 351 : id === 288 ? 317 : id === 386 ? WRITABLE : id === 387 ? WRITTEN : id);
const fromRef = (c) => (c ? { id: live(c.id), count: c.count, damage: c.damage, ...(c.tag ? { pages: c.tag.pages, author: c.tag.author, title: c.tag.title, ...(c.tag.name !== undefined ? { displayName: c.tag.name } : {}) } : {}) } : null);

test('items: ids, names, stack sizes, creative tab', () => {
  assert.equal(ORIGINAL_ITEMS[386], WRITABLE);
  assert.equal(ORIGINAL_ITEMS[387], WRITTEN);
  assert.equal(ITEMS[WRITABLE].stack, ref.facts.writable.maxStack);
  assert.equal(ITEMS[WRITTEN].stack, ref.facts.written.maxStack);
  assert.equal(ITEMS[WRITABLE].name, ref.facts.writable.name);
  assert.equal(liveNativeName(WRITTEN), ref.facts.written.name);
  assert.equal(ITEMS[WRITABLE].texture, 'book_writable');
  assert.equal(ITEMS[WRITTEN].texture, 'book_written');
  assert.ok(CREATIVE_TABS[ref.facts.writable.tab].items.some((e) => (Array.isArray(e) ? e[0] : e) === WRITABLE));
  for (const t of CREATIVE_TABS) assert.ok(!t.items.some((e) => (Array.isArray(e) ? e[0] : e) === WRITTEN), 'written book has no creative tab');
  assert.deepEqual(ref.facts.limits.gui, LIMITS.gui);
  assert.equal(ref.facts.limits.pageChars, LIMITS.pageChars);
});

test('validators match ItemWritableBook / ItemEditableBook', () => {
  for (const r of ref.valid) assert.equal(validWritable(r.tag), r.writable, 'writable: ' + r.name), assert.equal(validWritten(r.tag), r.written, 'written: ' + r.name);
});

test('display name and tooltip match ItemEditableBook', () => {
  for (const r of ref.display) {
    const stack = { id: WRITTEN, count: 1, damage: 0, ...(r.title !== null ? { title: r.title } : {}), ...(r.author !== null ? { author: r.author } : {}) };
    assert.equal(stackName(stack, ITEMS), r.name);
    assert.deepEqual(bookInfoLines(stack), r.lines);
    assert.equal(tooltipLines(ITEMS[WRITTEN], stack)[0].text, r.name);
    assert.ok(withGlint('<img src="/x.png">', stack, ITEMS[WRITTEN]).includes('enchant-glint'), 'always glints');
  }
  assert.ok(!withGlint('<img src="/x.png">', { id: WRITABLE, pages: ['a'] }, ITEMS[WRITABLE]).includes('enchant-glint'));
  const t = tooltipLines(ITEMS[WRITTEN], { id: WRITTEN, title: 'T', author: 'Steve', pages: [] });
  assert.deepEqual(t.slice(1), [{ text: 'by Steve', color: 'gray' }]);
});

test('font widths and word wrap match FontRenderer', () => {
  const widths = ref.charWidths.widths ?? ref.charWidths[0]?.widths ?? ref.charWidths;
  widths.forEach((w, i) => assert.equal(charWidth(String.fromCharCode(32 + i)), w, 'code ' + (32 + i)));
  assert.equal(ref.wrap.length, 64);
  for (const r of ref.wrap) {
    assert.equal(stringWidth(r.text), r.stringWidth, JSON.stringify(r.text));
    assert.deepEqual(listFormatted(r.text, r.width), r.lines, JSON.stringify(r.text) + ' @' + r.width);
    assert.equal(splitStringHeight(r.text, r.width), r.height);
  }
});

test('Book and Quill recipe and RecipeBookCloning', () => {
  const book = 314, feather = 317, ink = [351, 0];
  const match = (cells, size = 3) => craftingResult(cells, size);
  for (const r of ref.recipe) {
    const cells = r.cells.map(fromRef), out = match(cells, r.size);
    if (r.name.startsWith('book quill')) {
      assert.equal(out?.id, r.result?.id ? WRITABLE : undefined, r.name);
      if (out) assert.equal(out.count, 1);
    } else if (r.cloningResult?.error) {
      assert.equal(bookCloneResult(cells), null, r.name); // the original throws a NullPointerException
    } else if (r.cloningMatches) {
      const clone = bookCloneResult(cells);
      assert.equal(clone.id, WRITTEN);
      assert.equal(clone.count, r.cloningResult.count, r.name);
      assert.deepEqual([clone.pages, clone.author, clone.title], [r.cloningResult.tag.pages, r.cloningResult.tag.author, r.cloningResult.tag.title]);
      assert.equal(clone.displayName, r.cloningResult.tag.name);
      assert.equal(out.id, WRITTEN);
      assert.equal(out.count, r.cloningResult.count);
      assert.deepEqual(out.pages, r.cloningResult.tag.pages);
    } else assert.equal(bookCloneResult(cells), null, r.name);
  }
  assert.ok(SHAPELESS.some((s) => s.output === WRITABLE));
  assert.equal(match([makeStack(book), makeStack(351, 1, 0), makeStack(feather)])?.id, WRITABLE);
  assert.equal(match([makeStack(book), makeStack(351, 1, 4), makeStack(feather)]), null);
});

test('tags survive copy, merge identity, inventory read, drops of the stack object', () => {
  const a = makeStack(WRITTEN, 1, 0, undefined, { pages: ['one', 'two'], author: 'Steve', title: 'Saga' });
  assert.deepEqual(copyStack(a).pages, ['one', 'two']);
  assert.notEqual(copyStack(a).pages, a.pages);
  const b = copyStack(a);
  assert.ok(sameStackItem(a, b));
  b.pages = ['one', 'three'];
  assert.ok(!sameStackItem(a, b));
  const inv = new PlayerInventory(ITEMS, [{ ...a, count: 40 }]);
  assert.equal(inv.main[0].count, 16, 'written book stacks to 16');
  assert.deepEqual([inv.main[0].pages, inv.main[0].author, inv.main[0].title], [['one', 'two'], 'Steve', 'Saga']);
  const w = new PlayerInventory(ITEMS, [{ id: WRITABLE, count: 3, pages: ['x'] }]);
  assert.equal(w.main[0].count, 1);
  assert.ok(!sameStackItem({ id: WRITABLE, damage: 0 }, { id: WRITABLE, damage: 0, pages: ['x'] }));
});

test('NBT: pages / author / title round trip through a container tile', () => {
  const stacks = [{ id: WRITTEN, count: 1, damage: 0, pages: ['one', 'two\nlines', ''], author: 'Steve', title: 'Saga' }, { id: WRITABLE, count: 1, damage: 0, pages: [] }, { id: WRITABLE, count: 1, damage: 0 }];
  const tile = writeContainerTile('chests', { items: stacks }, 0, 64, 0);
  const items = tile.get('Items').value.items;
  const tag0 = items[0].get('tag').value;
  assert.equal(tag0.get('pages').type, NBT.LIST);
  assert.equal(tag0.get('pages').value.elementType, NBT.STRING);
  assert.deepEqual(tag0.get('pages').value.items, ['one', 'two\nlines', '']);
  assert.equal(tag0.get('author').value, 'Steve');
  assert.equal(tag0.get('title').value, 'Saga');
  assert.equal(items[2].get('tag'), undefined);
  const back = readContainerTile('Chest', tile);
  assert.ok(back);
  const read = back.record.items;
  assert.deepEqual([read[0].pages, read[0].author, read[0].title], [['one', 'two\nlines', ''], 'Steve', 'Saga']);
  assert.deepEqual(read[1].pages, []);
  assert.equal(read[2].pages, undefined);
});

const send = () => { const sent = []; return { sent, send: (c, p) => sent.push([c, p]) }; };
const screen = (item, editable, extra = {}) => new BookScreen({ item, editable, ...extra });
const type = (s, text) => { for (const ch of text) s.keyTyped(ch, 0); };

test('GuiScreenBook: typing, backspace, newline, page limits', () => {
  const s = screen({ id: WRITABLE, count: 1 }, true);
  type(s, 'hello');
  s.keyTyped('\0', 28); type(s, 'w'); s.keyTyped('\0', 14);
  assert.equal(s.current(), 'hello\n');
  assert.ok(s.modified);
  s.keyTyped('§', 0); s.keyTyped('\u007f', 0); s.keyTyped('\u0001', 0);
  assert.equal(s.current(), 'hello\n', 'section sign, DEL and control characters are ignored');
  // a page holds 13 wrapped lines at 118 pixels: the 14th line is refused
  for (let i = 0; i < 30; i++) s.keyTyped('\0', 28);
  assert.equal(listFormatted(s.current() + '§0_', 118).length, 13);
  assert.equal(s.current().split('\n').length, 13);
  const before = s.current();
  s.keyTyped('\0', 28);
  assert.equal(s.current(), before, 'a 14th line is refused');
  type(s, 'x');
  assert.equal(s.current(), before + 'x', 'text still fits on the 13th line');
  const t = screen({ id: WRITABLE, count: 1 }, true);
  type(t, 'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii'.repeat(6));
  assert.equal(t.current().length, 255, 'under 256 characters');
  assert.ok(isAllowedCharacter('a') && !isAllowedCharacter('§'));
});

test('GuiScreenBook: pages, buttons, limit of 50 pages', () => {
  const s = screen({ id: WRITABLE, count: 1 }, true);
  assert.deepEqual([s.buttons().next.visible, s.buttons().prev.visible, s.buttons().sign.visible, s.buttons().done.visible], [true, false, true, true]);
  type(s, 'a'); s.click(1); type(s, 'b'); s.click(2);
  assert.deepEqual([s.page, s.total, s.current()], [0, 2, 'a']);
  for (let i = 0; i < 80; i++) s.click(1);
  assert.deepEqual([s.page, s.total], [49, 50]);
  assert.equal(pageIndicator(s.page + 1, s.total), 'Page 50 of 50');
  const ro = screen({ id: WRITTEN, count: 1, pages: ['1', '2', '3'], author: 'A', title: 'T' }, false);
  assert.deepEqual([ro.buttons().next.visible, ro.buttons().prev.visible, ro.buttons().done.visible, ro.buttons().sign], [true, false, true, undefined]);
  type(ro, 'zzz'); assert.equal(ro.current(), '1');
  ro.click(1); ro.click(1); ro.click(1);
  assert.equal(ro.page, 2); assert.equal(ro.buttons().next.visible, false);
  assert.equal(pageIndicator(3, 3), 'Page 3 of 3');
});

test('GuiScreenBook: Done sends only a modified book and drops trailing empty pages', () => {
  const log = send(), held = { id: WRITABLE, count: 1 };
  const s = screen(held, true, { send: log.send, close: () => (log.closed = true) });
  s.click(0);
  assert.equal(log.sent.length, 0, 'unmodified: nothing sent');
  assert.ok(log.closed);
  const u = screen(held, true, { send: log.send });
  type(u, 'a'); u.click(1); u.click(1); u.click(1);
  u.click(0);
  assert.equal(log.sent.length, 1);
  assert.equal(log.sent[0][0], 'MC|BEdit');
  assert.deepEqual(log.sent[0][1].pages, ['a']);
  assert.equal(log.sent[0][1].id, WRITABLE);
  const esc = send(), v = screen({ id: WRITABLE, count: 1 }, true, { send: esc.send });
  type(v, 'x'); v.keyTyped('\0', 1);
  assert.equal(esc.sent.length, 0, 'Escape discards');
});

test('GuiScreenBook: signing screen, title rules, Sign and Close', () => {
  const log = send(), held = { id: WRITABLE, count: 1 };
  const s = screen(held, true, { send: log.send, playerName: 'Steve', close: () => (log.closed = true) });
  type(s, 'text');
  s.click(3);
  assert.ok(s.signing);
  assert.deepEqual([s.buttons().next.visible, s.buttons().prev.visible, s.buttons().done.visible, s.buttons().sign.visible, s.buttons().cancel.visible, s.buttons().finalize.enabled], [false, false, false, false, true, false]);
  type(s, '0123456789abcdefXYZ');
  assert.equal(s.title, '0123456789abcdef');
  assert.ok(s.buttons().finalize.enabled);
  s.keyTyped('\0', 14);
  assert.equal(s.title.length, 15);
  s.click(4);
  assert.ok(!s.signing);
  s.click(3);
  s.click(5);
  assert.equal(log.sent.length, 1);
  assert.equal(log.sent[0][0], 'MC|BSign');
  assert.deepEqual([log.sent[0][1].id, log.sent[0][1].title, log.sent[0][1].author, log.sent[0][1].pages], [WRITTEN, '0123456789abcde', 'Steve', ['text']]);
  assert.ok(log.closed);
  const blank = send(), b = screen({ id: WRITABLE, count: 1 }, true, { send: blank.send });
  type(b, 'p'); b.click(3); type(b, '   ');
  assert.equal(b.buttons().finalize.enabled, false, 'a title of spaces cannot be signed');
  b.keyTyped('\0', 28);
  assert.equal(blank.sent[0][1].title, '', 'Enter sends the trimmed title');
});

test('server: MC|BEdit and MC|BSign', () => {
  const held = { id: WRITABLE, count: 1, damage: 0 };
  assert.equal(applyBookEdit(held, { id: WRITABLE, pages: ['a', 'b'] }), true);
  assert.deepEqual(held.pages, ['a', 'b']);
  assert.throws(() => applyBookEdit(held, { id: WRITABLE, pages: ['x'.repeat(257)] }), /Invalid book tag/);
  assert.equal(applyBookEdit({ id: WRITTEN, count: 1 }, { id: WRITABLE, pages: ['a'] }), false);
  assert.equal(applyBookEdit(null, { id: WRITABLE, pages: ['a'] }), false);
  assert.equal(applyBookSign(held, { id: WRITTEN, pages: ['z'], title: 'T', author: 'Mallory' }, 'Steve'), true);
  assert.deepEqual([held.id, held.author, held.title, held.pages], [WRITTEN, 'Steve', 'T', ['z']]);
  assert.throws(() => applyBookSign({ id: WRITABLE, count: 1 }, { id: WRITTEN, pages: ['z'], title: 't'.repeat(17), author: 'x' }, 'S'), /Invalid book tag/);
  assert.equal(applyBookSign({ id: WRITTEN, count: 1 }, { id: WRITTEN, pages: ['z'], title: 't', author: 'x' }, 'S'), false, 'only a writable book can be signed');
});

test('/give with a data tag writes pages, author and title onto the stack', () => {
  const survival = new Survival({}, 'survival'), world = new World('books', 'meadow', 1), weather = new Weather(), experience = new Experience();
  const active = { mode: 'survival', allowCommands: true, seed: 'books' };
  const env = {
    active: () => active, world: () => world, weather: () => weather, mobs: () => null, survival: () => survival, experience: () => experience,
    position: () => ({ x: 10.5, y: 40, z: 10.5 }), seed: () => active.seed, stackName: (s) => stackName(s, ITEMS), giveDrop: (s) => survival.inventory.add(s), refreshInventory() {}, changed() {},
    setTime() {}, teleport() {}, setDifficulty() {}, setMode() {}, lan: () => false, shareToLan() {}, updateBlock() {}, destroyBlock() {},
  };
  const runner = createCommandRunner(createCommandHost(env));
  chat.clear();
  runner.run('/give @p minecraft:written_book 1 0 {title:"Saga",author:"Alex",pages:["one","two"]}');
  const given = survival.inventory.main.find(Boolean);
  assert.equal(given.id, WRITTEN);
  assert.deepEqual([given.title, given.author, given.pages], ['Saga', 'Alex', ['one', 'two']]);
  assert.match(chat.lines.map((l) => l.text).join('\n'), /Saga/);
  runner.run('/give @p minecraft:writable_book 1');
  assert.ok(survival.inventory.main.some((st) => st?.id === WRITABLE));
});

// GuiScreenBook against public/research/book-gui-reference.json (tools/verify-book-gui.mjs drives the unchanged bfe with the real
// FontRenderer): page text, indicator, cursor blink, keys, sign flow, button rules, sent stacks and unicode wrapping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BookScreen, BOOK_GUI as G, ITEM_WRITABLE_BOOK as WRITABLE, ITEM_WRITTEN_BOOK as WRITTEN, LANG, listFormatted, stringWidth, pageIndicator, byAuthor, bookCloneResult, bookDrawList, javaTrim, isAllowedCharacter } from './books.js';
import { font, setGlyphSizes, setUnicodeFlag, getCharWidth, getStringWidth } from './font-renderer.js';
import { PLAYER_NAME } from './village-host.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/book-gui-reference.json', import.meta.url)));
setGlyphSizes(readFileSync(new URL('../public/media/1.7.10/font/glyph_sizes.bin', import.meta.url)));

const fromRefStack = (s) => {
  const t = s.tag, out = { id: s.id === 386 ? WRITABLE : WRITTEN, count: s.count, damage: s.damage };
  if (t) {
    if (t.pages) out.pages = [...t.pages];
    if (t.author !== undefined) out.author = t.author;
    if (t.title !== undefined) out.title = t.title;
    if (t.name !== undefined) out.displayName = t.name;
  }
  return out;
};
const tagKeys = (s) => Object.keys(s.tag).length;
const packetShape = (p) => ({ channel: p.channel, id: p.stack.id, count: p.stack.count, pages: p.stack.tag.pages, author: p.stack.tag.author, title: p.stack.tag.title });
const portPacket = (channel, p) => ({ channel, id: p.id === WRITABLE ? 386 : 387, count: p.count, pages: p.pages, author: p.author, title: p.title });
const visible = (b) => b.filter((x) => x.visible).map((x) => x.id + (x.enabled ? '' : 'x')).join();
const portButtons = (screen) => {
  const b = screen.buttons(), out = [];
  if (screen.editable) { if (b.sign.visible) out.push(3); if (b.done.visible) out.push(0); if (b.finalize.visible) out.push(b.finalize.enabled ? 5 : '5x'); }
  else out.push(0);
  if (b.next.visible) out.push(1);
  if (b.prev.visible) out.push(2);
  if (screen.editable && b.cancel.visible) out.push(4);
  const order = (v) => ({ 3: 0, 0: 1, 5: 2, '5x': 2, 4: 3, 1: 4, 2: 5 }[v]);
  return out.sort((a, b2) => order(a) - order(b2)).join();
};
const refButtons = (b) => b.filter((x) => x.visible).map((x) => x.id + (x.enabled ? '' : 'x')).sort((a, c) => ({ 3: 0, 0: 1, 5: 2, '5x': 2, 4: 3, 1: 4, 2: 5 }[a] - { 3: 0, 0: 1, 5: 2, '5x': 2, 4: 3, 1: 4, 2: 5 }[c])).join();

// What GuiScreenBook.drawScreen draws, from the draw list book-ui.js renders (books.js bookDrawList).
const portDraw = (screen, name) => bookDrawList(screen, name).map(([kind, text, x, y]) => [kind === 'split' ? 'drawSplitString' : 'drawString', text, x, y]);
const refDraw = (d) => d.draw.map((e) => { assert.equal(e.color, 0); return [e.op, e.text, e.x, e.y]; });

test('layout constants equal the blit and draw positions of the original drawScreen', () => {
  assert.equal(G.top, 2);
  assert.equal(G.textX, 36);
  assert.equal(G.textY, 34);
  assert.equal(G.textWidth, 116);
  assert.equal(G.warningY, 82);
  assert.equal(G.titleLabelY, 34);
  assert.equal(G.titleY, 50);
  assert.equal(G.authorY, 60);
  for (const c of ref.gui) for (const s of c.steps) if (s.op === 'draw') {
    assert.deepEqual(s.blits, [{ x: 64, y: 2, u: 0, v: 0, w: 192, h: 192 }], c.name);
    assert.deepEqual(s.bound, ['textures/gui/book.png'], c.name);
    for (const b of s.state.buttons) if (b.id <= 0 || b.id >= 3) assert.equal(b.y, G.buttonY, c.name + ' button ' + b.id);
  }
});

test('button geometry and labels (Sign / Done / Sign and Close / Cancel, read-only Done)', () => {
  for (const c of ref.gui) {
    const open = c.steps[0].state, cx = 160;
    for (const b of open.buttons) {
      if (b.id === 3) assert.deepEqual([b.x, b.w, b.label], [cx - 100, 98, LANG['book.signButton']]);
      if (b.id === 0) assert.deepEqual([b.x, b.w, b.label], c.editable ? [cx + 2, 98, LANG['gui.done']] : [cx - 100, 200, LANG['gui.done']]);
      if (b.id === 5) assert.deepEqual([b.x, b.w, b.label], [cx - 100, 98, LANG['book.finalizeButton']]);
      if (b.id === 4) assert.deepEqual([b.x, b.w, b.label], [cx + 2, 98, LANG['gui.cancel']]);
      if (b.id === 1) assert.deepEqual([b.x - 64, b.y, b.w, b.h], [G.nextX, G.top + G.pageButtonY, 23, 13]);
      if (b.id === 2) assert.deepEqual([b.x - 64, b.y, b.w, b.h], [G.prevX, G.top + G.pageButtonY, 23, 13]);
    }
  }
});

test('every scenario replays through BookScreen: state, buttons, drawn text and sent stacks', () => {
  for (const c of ref.gui) {
    const first = c.steps[0].state, item = fromRefStack(first.item);
    const sent = [];
    let closed = 0;
    const name = (c.name.includes('another player') ? 'Alex' : 'Player');
    const screen = new BookScreen({ item, editable: c.editable, playerName: name, send: (ch, p) => sent.push(portPacket(ch, p)), close: () => closed++ });
    const where = (i, s) => `${c.name} #${i} ${s.op} ${JSON.stringify(s.arg).slice(0, 40)}`;
    c.steps.forEach((s, i) => {
      if (i > 0) {
        if (s.op === 'key') screen.keyTyped(String.fromCharCode(s.arg[0]), s.arg[1]);
        else if (s.op === 'type') for (const ch of s.arg) screen.keyTyped(ch, 0);
        else if (s.op === 'click' || s.op === 'clickMissed') screen.click(Number(s.arg));
        else if (s.op === 'clickN') for (let k = 0; k < s.arg[1]; k++) screen.click(s.arg[0]);
        else if (s.op === 'tick') for (let k = 0; k < Number(s.arg); k++) screen.tick();
        else if (s.op === 'paste') screen.paste(s.arg);
      }
      if (s.op === 'draw') { assert.deepEqual(portDraw(screen, name), refDraw(s), where(i, s)); }
      const st = s.state;
      assert.equal(screen.page, st.page, where(i, s) + ' page');
      assert.equal(screen.total, st.total, where(i, s) + ' total');
      assert.equal(screen.signing, st.signing, where(i, s) + ' signing');
      assert.equal(screen.modified, st.modified, where(i, s) + ' modified');
      assert.equal(screen.title, st.title, where(i, s) + ' title');
      assert.deepEqual(screen.pages ?? null, st.pages, where(i, s) + ' pages');
      assert.equal(portButtons(screen), refButtons(st.buttons), where(i, s) + ' buttons');
      assert.equal(closed, st.closed, where(i, s) + ' closed');
      assert.deepEqual(sent.splice(0).map((p) => ({ ...p })), st.packets.map(packetShape), where(i, s) + ' packets');
    });
  }
});

test('the sign title screen and the Sign and Close stack carry the player name', () => {
  assert.equal(PLAYER_NAME, 'Player');
  const c = ref.gui.find((x) => x.name === 'sign: title max 16, Sign and Close');
  const sentStack = c.steps.at(-1).state.packets[0].stack;
  assert.equal(sentStack.tag.author, PLAYER_NAME);
  assert.equal(sentStack.id, 387);
  assert.ok(!('generation' in sentStack.tag));
});

test('1.7.10 books have no generation tag: sent stacks and cloning results hold only pages, author, title and display', () => {
  const allowed = new Set(['pages', 'author', 'title', 'display']);
  for (const c of ref.gui) for (const s of c.steps) for (const p of s.state.packets) for (const k of p.stack.tag.keys) assert.ok(allowed.has(k), `${c.name}: ${k}`);
  const book = JSON.parse(readFileSync(new URL('../public/research/book-reference.json', import.meta.url)));
  let clones = 0;
  for (const r of book.recipe.filter((x) => x.name.startsWith('clone'))) {
    for (const res of [r.result, r.cloningResult]) if (res && res.tag) { clones++; for (const k of res.tag.keys) assert.ok(allowed.has(k), `${r.name}: ${k}`); }
  }
  assert.ok(clones > 10);
  // The port's cloning result copies the same tags and adds none.
  const src = { id: WRITTEN, count: 1, damage: 0, title: 'Saga', author: 'Steve', pages: ['a', 'b'] };
  const out = bookCloneResult([src, { id: WRITABLE, count: 1, damage: 0 }, { id: WRITABLE, count: 1, damage: 0 }]);
  assert.deepEqual(Object.keys(out).sort(), ['author', 'count', 'damage', 'id', 'pages', 'title']);
  assert.equal(out.count, 3);
  assert.equal(out.id, WRITTEN);
  assert.equal(out.author, 'Steve');
  assert.ok(!('generation' in out) && !('copy' in out));
  for (const k of ['pages', 'author', 'title']) assert.ok(k in src);
});

test('wrapping uses the real width tables (ascii.png and glyph_sizes.bin), for both unicode flags', () => {
  assert.ok(font.glyphSizes);
  try {
    for (const r of ref.wrapUnicode) {
      setUnicodeFlag(r.unicodeFlag);
      assert.equal(getStringWidth(r.text), r.stringWidth, 'width ' + JSON.stringify(r.text));
      assert.equal(stringWidth(r.text), r.stringWidth, 'books.js width ' + JSON.stringify(r.text));
      assert.deepEqual(listFormatted(r.text, r.width), r.lines, `lines ${r.unicodeFlag} ${r.width} ${JSON.stringify(r.text)}`);
    }
  } finally { setUnicodeFlag(false); }
  // Not the old flat 6 for glyphs above 126: accented letters come from the 256 table, CJK from glyph_sizes.bin.
  assert.equal(getCharWidth('ì'), 3);
  assert.equal(getCharWidth('ï'), 4);
  assert.ok(Array.from({ length: 128 }, (_, n) => getCharWidth(127 + n)).filter((w) => w !== 6).length > 30, 'not a flat 6');
});

test('Java trim and character filter edge cases the screen relies on', () => {
  assert.equal(javaTrim('  a b \u0001'), 'a b');
  assert.equal(javaTrim(' x '), ' x ');
  assert.ok(isAllowedCharacter('é') && !isAllowedCharacter('§') && !isAllowedCharacter('\u007f') && !isAllowedCharacter('\u0016'));
});

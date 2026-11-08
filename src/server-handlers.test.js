// NetHandlerPlayServer checks against public/research/server-handlers-reference.json (tools/verify-server-handlers.mjs drives the
// unchanged nh with test doubles): MC|BEdit and MC|BSign, creative drop and chat spam counters, held slot, sign text, reach checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SpamCounter, SPAM, creativeDrop, chatPacket, heldSlot, placementOutcome, digAllowed, useEntityAllowed, blockReach, entityReach, normalizeChat,
} from './server-handlers.js';
import { applyBookEdit, applyBookSign, ITEM_WRITABLE_BOOK as WRITABLE, ITEM_WRITTEN_BOOK as WRITTEN } from './books.js';
import { acceptLine } from './signs.js';
import { CreativeScreen } from './creative.js';
import { Survival } from './survival.js';
import { splitLayout } from './book-ui.js';
import { font, setGlyphSizes, setBidiFlag } from './font-renderer.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/server-handlers-reference.json', import.meta.url)));
const live = (id) => (id === 386 ? WRITABLE : id === 387 ? WRITTEN : id);
const fromRef = (c) => (c ? { id: live(c.id), count: c.count, damage: c.damage, ...(c.tag ? { pages: c.tag.pages, author: c.tag.author, title: c.tag.title, ...(c.tag.name !== undefined ? { displayName: c.tag.name } : {}) } : {}) } : null);
const view = (s) => (s ? { id: s.id, count: s.count, damage: s.damage, pages: s.pages ?? null, author: s.author ?? null, title: s.title ?? null } : null);
const packetOf = (c) => ({ id: live(c.id), pages: c.tag.pages, author: c.tag.author, title: c.tag.title });

test('reference is the 1.7.10 run and lists the classes it drove', () => {
  assert.equal(ref.target, 'Minecraft Java 1.7.10');
  for (const k of ['nh', 'oi', 'ael', 'aem', 'jm']) assert.match(ref.classes[k].sha256, /^[0-9a-f]{64}$/);
  assert.ok(ref.book.length >= 40 && ref.creative.length >= 10 && ref.chat.length >= 15);
});

test('MC|BEdit and MC|BSign: the held stack after each native case', () => {
  let changed = 0, refused = 0;
  for (const c of ref.book) {
    const held = fromRef(c.held), before = view(held);
    // a packet stack without a tag carries no book payload (the original throws on it or ignores it); the handler only edits the selected slot
    const packet = c.packet?.tag ? packetOf(c.packet) : null, target = c.slot === 0 ? held : null;
    let threw = false;
    try { (c.channel === 'MC|BEdit' ? applyBookEdit(target, packet) : applyBookSign(target, packet, c.player)); } catch (e) { threw = /Invalid book tag/.test(e.message); }
    assert.deepEqual(view(held), view(fromRef(c.after)), c.name);
    if (JSON.stringify(view(held)) !== JSON.stringify(before)) changed++; else refused++;
    if (threw) assert.deepEqual(view(held), before, c.name + ' (an invalid tag leaves the stack)');
  }
  assert.ok(changed >= 10 && refused >= 10, `changed ${changed} refused ${refused}`);
});

test('creative drops: +20 per drop, refused at 200, one per tick decay', () => {
  for (const c of ref.creative) {
    const counter = new SpamCounter();
    let now = 0;
    for (const s of c.steps) {
      if (s.op === 'tick') { now += s.n ?? s.m ?? 1; continue; }
      counter.decay(now);
      assert.equal(counter.value, s.before, c.name + ' before');
      if (s.slot >= 0) { assert.equal(s.after, s.before, c.name); continue; } // slot-set packets never reach the drop path
      const dropped = creativeDrop(counter, now, s.sent ? { id: s.sent.id, count: s.sent.count, damage: s.sent.damage } : null);
      assert.equal(dropped, s.events.length > 0, c.name + ' drop');
      assert.equal(counter.value, s.after, c.name + ' after');
    }
  }
});

test('chat: +20 per message, kicked above 200 unless exempt, illegal characters kick at once', () => {
  for (const c of ref.chat) {
    const counter = new SpamCounter();
    let now = 0;
    for (const s of c.steps) {
      if (s.op === 'tick') { now += s.n ?? s.m ?? 1; continue; }
      if (s.events.length === 0 && s.l === 0) continue; // chat hidden: the client never sends
      const out = chatPacket(counter, now, s.text, c.exempt);
      const kicked = s.events.find((e) => e.packet === 'gs');
      assert.equal(out.kick !== null, !!kicked, c.name + ' kick: ' + JSON.stringify(s.text));
      if (kicked) assert.equal(kicked.reason === 'disconnect.spam' ? 'Kicked for spamming' : kicked.reason, out.kick, c.name);
      const sent = s.events.find((e) => e.broadcast !== undefined || e.command !== undefined);
      assert.equal(out.deliver, sent ? (sent.broadcast ?? sent.command) : null, c.name + ' text');
      assert.equal(counter.value, s.l, c.name + ' counter');
      if (kicked) break;
    }
  }
});

test('chat text: whitespace runs collapse and the ends are trimmed after a 100 character cut', () => {
  assert.equal(normalizeChat('a\tb\nc'), 'a b c');
  assert.equal(normalizeChat('  x   y  '), 'x y');
  assert.equal(normalizeChat('z'.repeat(150)).length, 100);
  assert.equal(SPAM.chatKick, 200);
});

test('held item slot: only 0..8 changes the selection', () => {
  for (const c of ref.held[0].cases) assert.equal(heldSlot(c.sent, 3), c.sent >= 0 && c.sent <= 8 ? c.sent : c.selected, String(c.sent));
});

test('sign text: a line over 15 characters or with a disallowed one becomes !?', () => {
  for (const c of ref.sign[0].cases) {
    if (!c.after || c.after.every((l) => l === '') && c.sent.some((l) => l !== '')) continue; // tile not editable, someone else's, or not loaded
    assert.deepEqual(c.sent.map(acceptLine), c.after, c.name);
  }
});

test('placement, digging and use-entity distances', () => {
  for (const c of ref.placement[0].cases) {
    const out = placementOutcome({ player: c.player, pos: c.pos, face: c.face, hasMoved: c.hasMoved });
    const placed = c.events.some((e) => e.place), tooHigh = c.events.some((e) => e.packet === 'gj');
    assert.equal(out === 'place', placed, c.name);
    if (c.face !== 255) assert.equal(out === 'tooHigh', tooHigh, c.name);
  }
  for (const c of ref.digging[0].cases) {
    if (c.status > 2) continue;
    assert.equal(digAllowed({ player: c.player, pos: c.pos }), c.events.some((e) => e.dig), c.name);
  }
  for (const c of ref.useEntity[0].cases) {
    if (c.type !== 'mob') continue;
    assert.equal(useEntityAllowed([0, 64, 0], c.entity, c.visible), c.events.some((e) => e.entity), c.action + ' ' + c.name);
  }
});

test('reach: creative 5 blocks and 6 entities, survival 4.5 and 3', () => {
  assert.deepEqual([blockReach(true), blockReach(false), entityReach(true), entityReach(false)], [5, 4.5, 6, 3]);
});

test('creative screen shares one drop counter: the 11th drop in a tick is refused and decays per tick', () => {
  const p = new Survival({ slots: [] }, 'creative');
  let tick = 0;
  const gui = new CreativeScreen(p.inventory, { playerContainer: () => p.openInventory(), tooltip: () => [], tick: () => tick });
  const stack = () => ({ id: 3, count: 16, damage: 0 });
  for (let i = 0; i < 12; i++) gui.drop(stack());
  assert.equal(gui.container.drops.length, 10);
  tick = 1;
  gui.drop(stack());
  assert.equal(gui.container.drops.length, 11, 'one tick frees exactly one drop');
  gui.drop(stack());
  assert.equal(gui.container.drops.length, 11);
  tick = 1000;
  for (let i = 0; i < 10; i++) gui.drop(stack());
  assert.equal(gui.container.drops.length, 21);
  const again = new CreativeScreen(p.inventory, { playerContainer: () => p.openInventory(), tooltip: () => [], tick: () => tick });
  again.drop(stack());
  assert.equal(again.container.drops.length, 0, 'a reopened screen keeps the counter');
});

test('book screen honours the bidirectional flag (bbu drawSplitString)', () => {
  setGlyphSizes(readFileSync(new URL('../public/media/1.7.10/font/glyph_sizes.bin', import.meta.url)));
  const text = 'abc אבג def';
  const off = splitLayout(text, 36, 32, 116, false), on = splitLayout(text, 36, 32, 116, true);
  assert.equal(off[0].x, 36, 'left aligned without the flag');
  assert.ok(on[0].x > 36 && on[0].x < 36 + 116, 'right aligned at x + width - reordered width with the flag');
  assert.equal(on.map((l) => l.y).join(), off.map((l) => l.y).join());
  setBidiFlag(true);
  try { assert.deepEqual(splitLayout(text, 36, 32, 116), on, 'the default follows font.bidi'); } finally { setBidiFlag(false); }
  assert.deepEqual(splitLayout(text, 36, 32, 116), off);
  assert.equal(font.bidi, false);
});

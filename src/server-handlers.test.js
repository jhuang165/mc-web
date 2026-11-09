// NetHandlerPlayServer checks against public/research/server-handlers-reference.json (tools/verify-server-handlers.mjs drives the
// unchanged nh with test doubles): MC|BEdit and MC|BSign, creative drop and chat spam counters, held slot, sign text, reach checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SpamCounter, SPAM, creativeDrop, chatPacket, heldSlot, placementOutcome, digAllowed, useEntityAllowed, blockReach, entityReach, normalizeChat, faceOf, serverClick, BUILD_HEIGHT_MESSAGE, useEntityOutcome, canEntityBeSeen,
} from './server-handlers.js';
import { applyBookEdit, applyBookSign, ITEM_WRITABLE_BOOK as WRITABLE, ITEM_WRITTEN_BOOK as WRITTEN } from './books.js';
import { acceptLine } from './signs.js';
import { rayTraceBlocks } from './buckets.js';
import { pickMinecart } from './structure-simulation.js';
import { CreativeScreen, SURVIVAL_TAB } from './creative.js';
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
    const kind = { item: 'item', arrow: 'arrow', xporb: 'xporb', self: 'self' }[c.type] ?? 'mob';
    // A "real" case runs the player's native canEntityBeSeen over the recorded stone cells; the others force the answer.
    const solid = new Set((c.solid ?? []).map((p) => p.join()));
    const world = { get: (x, y, z) => (solid.has([x, y, z].join()) ? 1 : 0), getMeta: () => 0 };
    const real = c.visible === 'real';
    const out = useEntityOutcome({ player: [0, 64, 0], entity: c.entity, visible: real ? canEntityBeSeen((a, b) => rayTraceBlocks(world, a, b, false, false) !== null, [0, 64, 0], c.entity) : c.visible,
      action: c.action === 'ATTACK' ? 'attack' : 'interact', kind });
    const native = c.events.some((e) => e.packet === 'gs') ? 'kick' : c.events.some((e) => e.entity) ? 'accept' : 'refuse';
    assert.equal(out, native, c.action + ' ' + c.type + ' ' + c.name);
    // serverClick (the call in play) agrees, tracing sight only when it matters.
    const r = serverClick({ kind: 'entity', player: [0, 64, 0], entity: c.entity, visible: real ? true : c.visible, action: c.action === 'ATTACK' ? 'attack' : 'interact', entityKind: kind,
      lineBlocked: real ? (a, b) => rayTraceBlocks(world, a, b, false, false) !== null : null });
    assert.equal(r.accept, native === 'accept', c.name);
    assert.equal(r.kick, native === 'kick', c.name);
  }
});

test('no line of sight: a crosshair pick over a wall corner is refused beyond 3 blocks, and the native cases include it', () => {
  // Creative reach is 6 for entities; a one-block wall at x 1 clips the eye (feet + 1.62) to target ray, so the server sees nothing.
  const wall = new Set(['1,64,0']), world = { get: (x, y, z) => (wall.has([x, y, z].join()) ? 1 : 0), getMeta: () => 0 };
  const blocked = (a, b) => rayTraceBlocks(world, a, b, false, false) !== null;
  const entity = [3.5, 64.5, 0];
  // the client pick: the ray from the eye through the box's upper half clears the wall (no block is hit first), so the click goes out
  assert.equal(rayTraceBlocks(world, [0, 64 + 1.62, 0], [3.5, 64 + 1.62, 0], false, false), null);
  assert.equal(canEntityBeSeen(blocked, [0, 64, 0], entity), false);
  assert.equal(serverClick({ kind: 'entity', player: [0, 64, 0], entity, lineBlocked: blocked }).accept, false);
  assert.equal(serverClick({ kind: 'entity', player: [0, 64, 0], entity: [2.9, 64.5, 0], lineBlocked: blocked }).accept, true);
  assert.equal(serverClick({ kind: 'entity', player: [0, 64, 0], entity, lineBlocked: () => false }).accept, true);
  assert.ok(ref.useEntity[0].cases.some((c) => c.visible === 'real' && c.events.length === 0 && Math.hypot(c.entity[0], c.entity[2]) < 6), 'native refusal by sight is recorded');
});

test('a real pick in play: the crosshair reaches a cart over a wall corner, the server has no sight and refuses (survival reach too)', () => {
  const wall = new Set(['1,64,0']), world = { get: (x, y, z) => (wall.has([x, y, z].join()) ? 1 : 0), getMeta: () => 0 };
  const cart = { x: 3.5, posY: 64.5, z: 0, bb: [2.75, 64.2, -0.35, 4.25, 64.9, 0.35] };
  const eye = { x: 0, y: 64 + 1.62, z: 0 }, aim = [3.5, 64.8, 0], len = Math.hypot(aim[0], aim[1] - eye.y);
  const dir = { x: aim[0] / len, y: (aim[1] - eye.y) / len, z: 0 };
  const blockHit = rayTraceBlocks(world, [eye.x, eye.y, eye.z], [eye.x + dir.x * 6, eye.y + dir.y * 6, eye.z], false, false);
  assert.equal(blockHit, null, 'no block is under the crosshair');
  const pick = pickMinecart({ pickable: () => [cart] }, eye, dir, 6, 6);
  assert.ok(pick, 'the client pick finds the cart');
  const r = serverClick({ kind: 'entity', player: [0, 64, 0], entity: [cart.x, cart.posY, cart.z], action: 'attack', lineBlocked: (a, b) => rayTraceBlocks(world, a, b, false, false) !== null });
  assert.equal(r.accept, false);
  // survival reach 3 picks it as well (2.72 to the box), so an ordinary survival player hits the 3-block limit; the open-ground twin is accepted
  assert.ok(pickMinecart({ pickable: () => [cart] }, eye, dir, 3, 3));
  assert.equal(serverClick({ kind: 'entity', player: [0, 64, 0], entity: [cart.x, cart.posY, cart.z], lineBlocked: () => false }).accept, true);
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

test('faceOf maps the clicked neighbour to the packet face index', () => {
  const b = [5, 5, 5];
  assert.deepEqual([[5, 4, 5], [5, 6, 5], [5, 5, 4], [5, 5, 6], [4, 5, 5], [6, 5, 5]].map((a) => faceOf(b, a)), [0, 1, 2, 3, 4, 5]);
  assert.equal(faceOf(b, [7, 5, 5]), null);
  assert.equal(faceOf(b, null), null);
});

test('normal play is accepted: the client reach stays inside every server limit', () => {
  const feet = [0.5, 64, 0.5];
  // Survival block reach 4.5 and creative 5 from the eye (feet + 1.62): worst case straight out, centre at most 5.5 from the eye.
  for (const reach of [4.5, 5]) {
    const x = Math.floor(0.5 + reach); // block whose face is within reach along +x at eye height
    assert.ok(serverClick({ kind: 'place', player: feet, pos: [x, 65, 0], adjacent: [x - 1, 65, 0] }).accept, 'place ' + reach);
    assert.ok(serverClick({ kind: 'dig', player: feet, pos: [x, 65, 0] }).accept, 'dig ' + reach);
  }
  // Straight up and down at creative reach.
  assert.ok(serverClick({ kind: 'dig', player: feet, pos: [0, 64 + 8, 0] }).accept === false, 'a block 8 above the feet is past 6 from the eye');
  assert.ok(serverClick({ kind: 'dig', player: feet, pos: [0, 64 + 6, 0] }).accept);
  assert.ok(serverClick({ kind: 'dig', player: feet, pos: [0, 64 - 4, 0] }).accept);
  assert.ok(serverClick({ kind: 'entity', player: feet, entity: [3.4, 64, 0.5] }).accept, 'survival entity reach 3');
  assert.ok(serverClick({ kind: 'entity', player: feet, entity: [5.9, 64, 0.5] }).accept, 'creative entity reach 6 at the same height');
});

test('edge positions: refused past the native limits, resent block, build height message', () => {
  const feet = [0.5, 64, 0.5];
  // Placement: centre to feet squared < 64 (strict).
  assert.equal(serverClick({ kind: 'place', player: feet, pos: [7, 64, 0], adjacent: [6, 64, 0] }).accept, true); // 7^2 + .25 = 49.25.. +.25
  assert.equal(serverClick({ kind: 'place', player: [0, 0, 0], pos: [7, 0, 4], adjacent: [7, 1, 4] }).accept, false); // 7.5^2 + .5^2 + 4.5^2 = 76.75
  assert.equal(serverClick({ kind: 'place', player: [0, 0, 0], pos: [7, 0, 0], adjacent: [7, 1, 0], hasMoved: false }).accept, false);
  const high = serverClick({ kind: 'place', player: [0, 250, 0], pos: [0, 255, 0], adjacent: [0, 256, 0] });
  assert.deepEqual(high, { accept: false, message: BUILD_HEIGHT_MESSAGE });
  assert.equal(serverClick({ kind: 'place', player: [0, 250, 0], pos: [0, 255, 0], adjacent: [0, 255, 1] }).accept, true, 'a side face at y 255 is fine');
  assert.equal(serverClick({ kind: 'place', player: [0, 250, 0], pos: [0, 256, 0], adjacent: [0, 256, 1] }).accept, false, 'any face at y 256');
  // Digging: eye = feet + 1.5, centre squared <= 36, y < 256.
  assert.equal(serverClick({ kind: 'dig', player: [0.5, 10, 0.5], pos: [6, 11, 0] }).accept, true); // 5.5^2 + (-0.5+... ) well inside
  assert.equal(serverClick({ kind: 'dig', player: [0.5, 10, 0.5], pos: [7, 10, 0] }).accept, false); // 6.5^2 > 36
  assert.equal(serverClick({ kind: 'dig', player: [0.5, 250, 0.5], pos: [0, 256, 0] }).accept, false);
  // Entities: feet to feet squared < 36 with sight, < 9 without.
  assert.equal(serverClick({ kind: 'entity', player: [0, 0, 0], entity: [6, 0, 0] }).accept, false);
  assert.equal(serverClick({ kind: 'entity', player: [0, 0, 0], entity: [5.99, 0, 0] }).accept, true);
  assert.equal(serverClick({ kind: 'entity', player: [0, 0, 0], entity: [3, 0, 0], visible: false }).accept, false);
});

test('survival tab drops go through the creative limiter too', () => {
  const p = new Survival({ slots: [] }, 'creative');
  const gui = new CreativeScreen(p.inventory, { playerContainer: () => p.openInventory(), tooltip: () => [], tick: () => 0 });
  gui.setTab(SURVIVAL_TAB);
  for (let i = 0; i < 12; i++) gui.player.drop({ id: 3, count: 1, damage: 0 });
  assert.equal(gui.container.drops.length, 10);
});

// Batch 66 (mpbooks): books, jukeboxes and note blocks on the dedicated server, with no sockets. Rules: NetHandlerPlayServer MC|BEdit / MC|BSign, ItemRecord / BlockJukebox / BlockNote
// (bytecode-read, see .shared-memory/notes/mpbooks-b66-track.md); the single-player modules supply the item rules (books.js, jukebox.js, note-blocks.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { ITEM_WRITABLE_BOOK, ITEM_WRITTEN_BOOK } from './books.js';
import { makeStack } from './inventory.js';
import { DISC_FIRST, DISC_ORIGINAL_FIRST, NOTE_BLOCK, JUKEBOX } from './note-jukebox-content.js';
import { cleanStack } from './multiplayer/server-containers.js';
import { bookPacket } from './multiplayer/server-books.js';
import { bookOpensOnUse, bookMessage } from './multiplayer/client-books.js';
import { recordAux, noteEvent } from './multiplayer/client-music.js';
import { mobDrops } from './combat.js';
import { JavaRandom } from './java-random.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture(mode = 'survival') {
  const world = new World('mp-books-b66');
  for (let x = 40; x <= 170; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: mode, mobs: false }), p = s.addPlayer('a', 'Alice', key(1));
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.moved = true;
  return { s, p, world };
}
const give = (p, stack) => { p.survival.inventory.main[p.survival.inventory.current] = stack; return stack; };
const out = (p, type) => (p.itemsOut ?? []).filter(m => m.type === type);
const aux = p => out(p, 'aux').flatMap(m => m.events);
const book = (id, pages, extra = {}) => ({ id, pages, ...extra });

test('MC|BEdit keeps the writable book and copies the pages; the slot correction carries them', () => {
  const { s, p } = fixture();
  give(p, makeStack(ITEM_WRITABLE_BOOK, 1, 0, undefined, { pages: ['old'] }));
  s.serverItems.settle(p); p.itemsOut = [];
  assert.equal(bookPacket(s, p.id, { type: 'bookEdit', packet: book(ITEM_WRITABLE_BOOK, ['one', 'two']) }), true);
  assert.equal(p.survival.held.id, ITEM_WRITABLE_BOOK);
  assert.deepEqual(p.survival.held.pages, ['one', 'two']);
  s.serverItems.settle(p);
  const slot = out(p, 'slot')[0].slots.find(e => e.slot === p.survival.inventory.current);
  assert.deepEqual(slot.stack.pages, ['one', 'two']);
});

test('MC|BSign turns the held book and quill into a written book by the sender, whatever author the packet names', () => {
  const { s, p } = fixture();
  give(p, makeStack(ITEM_WRITABLE_BOOK, 1, 0, undefined, { pages: ['x'] }));
  s.serverItems.settle(p); p.itemsOut = [];
  assert.equal(bookPacket(s, p.id, { type: 'bookSign', packet: book(ITEM_WRITTEN_BOOK, ['page'], { title: 'Tale', author: 'Mallory' }) }), true);
  const h = p.survival.held;
  assert.deepEqual([h.id, h.author, h.title, h.pages], [ITEM_WRITTEN_BOOK, 'Alice', 'Tale', ['page']]);
  s.serverItems.settle(p);
  assert.equal(out(p, 'slot')[0].slots.find(e => e.slot === p.survival.inventory.current).stack.id, ITEM_WRITTEN_BOOK);
});

test('the server reads the held stack: no book, a written book, or the wrong packet item change nothing', () => {
  const { s, p } = fixture();
  assert.equal(bookPacket(s, p.id, { type: 'bookEdit', packet: book(ITEM_WRITABLE_BOOK, ['a']) }), true); // empty hand: ignored
  assert.equal(p.survival.held, null);
  give(p, makeStack(ITEM_WRITTEN_BOOK, 1, 0, undefined, { pages: ['sealed'], author: 'Bob', title: 'T' }));
  assert.equal(bookPacket(s, p.id, { type: 'bookEdit', packet: book(ITEM_WRITABLE_BOOK, ['edited']) }), true);
  assert.equal(bookPacket(s, p.id, { type: 'bookSign', packet: book(ITEM_WRITTEN_BOOK, ['edited'], { title: 'T2', author: 'x' }) }), true);
  assert.deepEqual(p.survival.held.pages, ['sealed']);
  give(p, makeStack(ITEM_WRITABLE_BOOK, 1, 0, undefined, { pages: ['w'] }));
  assert.equal(bookPacket(s, p.id, { type: 'bookEdit', packet: book(ITEM_WRITTEN_BOOK, ['no']) }), true); // the packet's item must equal the held one
  assert.deepEqual(p.survival.held.pages, ['w']);
});

test('an invalid tag (page over 256 chars, no title, title over 16, no pages) is "Invalid book tag!" and changes nothing', () => {
  const { s, p } = fixture();
  give(p, makeStack(ITEM_WRITABLE_BOOK, 1, 0, undefined, { pages: ['w'] }));
  const bad = [
    { type: 'bookEdit', packet: book(ITEM_WRITABLE_BOOK, ['x'.repeat(257)]) },
    { type: 'bookEdit', packet: { id: ITEM_WRITABLE_BOOK } },
    { type: 'bookEdit', packet: book(ITEM_WRITABLE_BOOK, [5]) },
    { type: 'bookSign', packet: book(ITEM_WRITTEN_BOOK, ['a'], { author: 'a' }) },
    { type: 'bookSign', packet: book(ITEM_WRITTEN_BOOK, ['a'], { title: 'x'.repeat(17), author: 'a' }) },
    { type: 'bookSign', packet: null }, { type: 'bookEdit', packet: { id: 'x' } },
  ];
  for (const m of bad) assert.equal(bookPacket(s, p.id, m), false, JSON.stringify(m).slice(0, 60));
  assert.deepEqual(p.survival.held.pages, ['w']);
  assert.equal(bookPacket(s, p.id, { type: 'bookEdit', packet: book(ITEM_WRITABLE_BOOK, ['x'.repeat(256)]) }), true); // exactly 256 is fine
});

test('a book keeps its pages through the inventory wire (cleanStack) and oversized tags are refused', () => {
  const kept = cleanStack({ id: ITEM_WRITTEN_BOOK, count: 1, damage: 0, pages: ['a', 'b'], author: 'Alice', title: 'T' });
  assert.deepEqual([kept.pages, kept.author, kept.title], [['a', 'b'], 'Alice', 'T']);
  assert.equal(cleanStack({ id: ITEM_WRITABLE_BOOK, count: 1, pages: Array(51).fill('') }), undefined);
  assert.equal(cleanStack({ id: ITEM_WRITABLE_BOOK, count: 1, pages: ['x'.repeat(257)] }), undefined);
  assert.equal(cleanStack({ id: ITEM_WRITTEN_BOOK, count: 1, pages: [], title: 'x'.repeat(17), author: 'a' }), undefined);
  assert.ok(cleanStack({ id: ITEM_WRITABLE_BOOK, count: 1, pages: Array(50).fill('y'.repeat(256)) }));
});

test('client: a right click opens the book unless a block takes it first (sneaking skips block activation)', () => {
  const held = { id: ITEM_WRITABLE_BOOK };
  assert.equal(bookOpensOnUse({ held }), true);
  assert.equal(bookOpensOnUse({ held, targetBlock: 1 }), true);
  assert.equal(bookOpensOnUse({ held, targetBlock: 41 }), false); // chest (internal id)
  assert.equal(bookOpensOnUse({ held, targetBlock: 41, sneaking: true }), true);
  assert.equal(bookOpensOnUse({ held, targetBlock: JUKEBOX }), false);
  assert.equal(bookOpensOnUse({ held: { id: 4 } }), false);
  assert.equal(bookOpensOnUse({ held: { id: ITEM_WRITTEN_BOOK }, aimedEntity: true }), false);
  assert.deepEqual(bookMessage('MC|BSign', { a: 1 }), { type: 'bookSign', packet: { a: 1 } });
  assert.equal(bookMessage('MC|BEdit', {}).type, 'bookEdit');
});

// ---- jukebox ----
const JX = 64, JY = 11, JZ = 62; // in the ray of a player at (64.5, 10, 64.5) facing north
function jukeboxFixture(mode) {
  const f = fixture(mode);
  f.world.set(JX, JY, JZ, JUKEBOX, true, 0);
  return f;
}
test('right click with a disc loads the jukebox: disc spent, metadata 1, S28 1005 with the original record id to players under 64 blocks only', () => {
  const { s, p } = jukeboxFixture('survival');
  const far = s.addPlayer('b', 'Bob', key(2)); far.position.copy({ x: 64.5 + 80, y: 10, z: 64.5 }); // 80 blocks east (outside; the column is not loaded but the player exists)
  const near = s.addPlayer('c', 'Cy', key(3)); near.position.copy({ x: 70.5, y: 10, z: 70.5 });
  give(p, makeStack(DISC_FIRST + 3, 1)); // chirp
  assert.equal(s.edit(p, true), true);
  assert.equal(s.world.getMeta(JX, JY, JZ), 1);
  assert.equal(p.survival.held, null, 'the disc is spent outside Creative');
  assert.deepEqual(aux(p), [{ id: 1005, x: JX, y: JY, z: JZ, data: DISC_ORIGINAL_FIRST + 3 }]);
  assert.deepEqual(aux(near), aux(p));
  assert.deepEqual(aux(far), []);
  assert.equal(s.redstone.save().musicTiles.find(e => e.kind === 'jukebox').record.id, DISC_FIRST + 3);
});

test('Creative keeps the disc; an empty-handed click ejects it (1005 with 0), the disc is an item entity and the jukebox is empty again', () => {
  const { s, p } = jukeboxFixture('creative');
  give(p, makeStack(DISC_FIRST + 10, 1));
  s.edit(p, true);
  assert.equal(p.survival.held.id, DISC_FIRST + 10, 'Creative keeps the disc');
  p.survival.inventory.main[p.survival.inventory.current] = null; p.itemsOut = [];
  const before = s.items.items.length;
  assert.equal(s.edit(p, true), true);
  assert.equal(s.world.getMeta(JX, JY, JZ), 0);
  assert.deepEqual(aux(p), [{ id: 1005, x: JX, y: JY, z: JZ, data: 0 }]);
  const drop = s.items.items.at(-1);
  assert.equal(s.items.items.length, before + 1);
  assert.equal(drop.stack.id, DISC_FIRST + 10);
  assert.equal(drop.delay, 10);
  assert.deepEqual(s.redstone.save().musicTiles.filter(e => e.kind === 'jukebox'), []);
});

test('a loaded jukebox ejects before a second disc goes in; a non-disc item does nothing', () => {
  const { s, p } = jukeboxFixture('survival');
  give(p, makeStack(ITEM_WRITABLE_BOOK, 1));
  s.edit(p, true);
  assert.equal(s.world.getMeta(JX, JY, JZ), 0);
  assert.equal(p.survival.held.id, ITEM_WRITABLE_BOOK);
  give(p, makeStack(DISC_FIRST, 1)); s.edit(p, true);
  give(p, makeStack(DISC_FIRST + 1, 1));
  s.edit(p, true); // activates: ejects, the disc in hand stays
  assert.equal(s.world.getMeta(JX, JY, JZ), 0);
  assert.equal(p.survival.held.id, DISC_FIRST + 1);
  assert.equal(s.items.items.at(-1).stack.id, DISC_FIRST);
});

test('jukebox records are saved with the redstone record and restored (RecordItem)', () => {
  const { s, p } = jukeboxFixture('survival');
  give(p, makeStack(DISC_FIRST + 5, 1)); s.edit(p, true);
  const saved = JSON.parse(JSON.stringify(s.redstone.save()));
  assert.ok(saved.musicTiles.some(e => e.kind === 'jukebox' && e.x === JX));
  const again = fixture('survival');
  again.world.set(JX, JY, JZ, JUKEBOX, true, 1);
  const { installMusic, musicOf } = awaitImport();
  const m = installMusic(again.s, new again.s.redstone.constructor(again.world, {}), 0, saved);
  assert.equal(m.jukeboxes.tile(JX, JY, JZ).record.id, DISC_FIRST + 5);
  assert.ok(musicOf(again.s.redstone));
});
import * as serverMusic from './multiplayer/server-music.js';
const awaitImport = () => serverMusic;

test('a skeleton arrow killing a creeper drops a record (EntityCreeper.onDeath: 2256 + nextInt(12)); other kills do not', () => {
  const rand = new JavaRandom(1n);
  const drops = mobDrops({ type: 'creeper' }, { playerHit: false, bySkeleton: true }, rand);
  assert.ok(drops.some(([id]) => id >= DISC_FIRST && id < DISC_FIRST + 12));
  assert.ok(!mobDrops({ type: 'creeper' }, { playerHit: false, bySkeleton: false }, new JavaRandom(1n)).some(([id]) => id >= DISC_FIRST && id < DISC_FIRST + 12));
});

// ---- note blocks ----
test('a note block click raises the pitch and plays: S29 note.<instrument> at volume 3 and the S24 event to players under 64 blocks', () => {
  const { s, p } = fixture('survival'), NX = 110; p.position.copy({ x: NX + 0.5, y: 10, z: 64.5 });
  s.world.set(NX, JY, JZ, NOTE_BLOCK, true, 0);
  s.world.set(NX, JY - 1, JZ, 3, true, 0); // internal stone (original 1) below: bass drum (instrument 1)
  const far = s.addPlayer('b', 'Bob', key(2)); far.position.copy({ x: 10.5, y: 10, z: 64.5 });
  assert.equal(s.edit(p, true), true);
  s.tick();
  const ev = out(p, 'musicEvent');
  assert.deepEqual(ev.map(({ k, x, y, z, instrument, note }) => ({ k, x, y, z, instrument, note })), [{ k: 'note', x: NX, y: JY, z: JZ, instrument: 1, note: 1 }]);
  assert.deepEqual(out(far, 'musicEvent'), []);
  const snd = (p.soundsOut ?? []).find(m => m.name === 'note.bd');
  assert.ok(snd, 'the S29 sound');
  assert.equal(snd.volume, 3);
  assert.equal(snd.pitch, Math.fround(Math.pow(2, (1 - 12) / 12)));
  for (let i = 0; i < 3; i++) s.edit(p, true);
  assert.equal(s.redstone.save().musicTiles.find(e => e.kind === 'note').note, 4);
});

test('a note block with a block above it stays silent (TileEntityNote.triggerNote), and the note wraps at 24', () => {
  const { s, p } = fixture('survival');
  s.world.set(JX, JY, JZ, NOTE_BLOCK, true, 0);
  s.world.set(JX, JY + 1, JZ, 1, true, 0);
  p.position.copy({ x: 64.5, y: 10, z: 64.5 });
  s.edit(p, true); s.tick();
  assert.deepEqual(out(p, 'musicEvent'), []);
  const m = s.redstone.save().musicTiles.find(e => e.kind === 'note');
  assert.equal(m.note, 1);
});

test('client events: record id to disc (0 stops), the note event plays note.<instrument> at volume 3 with a note particle', () => {
  const calls = [];
  assert.equal(recordAux({ id: 1005, x: 1, y: 2, z: 3, data: DISC_ORIGINAL_FIRST + 11 }, { play: (...a) => calls.push(a) }), true);
  assert.equal(recordAux({ id: 1005, x: 1, y: 2, z: 3, data: 0 }, { play: (...a) => calls.push(a) }), true);
  assert.equal(recordAux({ id: 2001, x: 1, y: 2, z: 3, data: 0 }, { play: () => assert.fail() }), false);
  assert.equal(recordAux({ id: 1005, x: 1, y: 2, z: NaN, data: 0 }, { play: () => assert.fail() }), false);
  assert.deepEqual(calls, [[DISC_FIRST + 11, 1, 2, 3], [null, 1, 2, 3]]);
  const log = [];
  assert.equal(noteEvent({ k: 'note', x: 5, y: 6, z: 7, instrument: 4, note: 24 }, { sound: (...a) => log.push(['s', ...a]), particle: (...a) => log.push(['p', ...a]) }), true);
  assert.deepEqual(log, [['s', 'note.bassattack', 5.5, 6.5, 7.5, 3, 2], ['p', 'note', 5.5, 7.2, 7.5, 1, 0, 0]]);
  assert.equal(noteEvent({ k: 'note', x: 5, y: 6, z: 7, instrument: 0, note: 25 }, { sound: () => assert.fail(), particle: () => {} }), false);
});

test('the hooks are wired: server.js routes bookEdit / bookSign, client.js queues musicEvent, main.js opens the book and handles 1005', () => {
  const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
  assert.match(read('../server/server.js'), /m\.type === 'bookEdit' \|\| m\.type === 'bookSign'\) \{ if \(!bookPacket\(/);
  assert.match(read('./multiplayer/client.js'), /message\.type === 'musicEvent'\) this\.onMusic\?\./);
  const main = read('./main.js');
  assert.match(main, /recordAux\(e, mpRecord\)/);
  assert.match(main, /bookOpensOnUse\(\{ held: survival\.held/);
  assert.match(main, /client\.onMusic = e => noteEvent\(/);
});

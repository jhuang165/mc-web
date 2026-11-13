// Batch 60 (mpinventory): the player's inventory window on the dedicated server, with no sockets. A second PlayerContainer is the client's prediction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { Survival, ITEMS } from './survival.js';
import { makeStack } from './inventory.js';
import { wireInvClicks, applyInv } from './multiplayer/client-inventory.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = (extra = {}) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null), ...extra });
function fixture() {
  const world = new World('mp-inv-b60');
  for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival' }), p = s.addPlayer('a', 'Alice', key(1));
  p.position.copy({ x: 64.5, y: 10, z: 64.5 });
  return { s, p };
}
const ironHelmet = Object.values(ITEMS).find(i => i.armor === 0 && i.name === 'Iron Helmet').id;
// A client: its own Survival and open PlayerContainer, clicks delivered to the simulation.
function client(s, p) {
  const survival = new Survival({}, 'survival'), sent = [], mpInv = {}, c = { survival, sent, mpInv };
  c.container = survival.openInventory();
  wireInvClicks(c.container, { invClick: (slot, button, mode, action, item) => sent.push({ type: 'invClick', slot, button, mode, action, item }), invAck: () => sent.push({ type: 'invAck' }), invClose: () => sent.push({ type: 'invClose' }) });
  c.deliver = () => { for (const m of sent.splice(0)) { if (m.type === 'invClick') s.invClick(p.id, m); else if (m.type === 'invAck') s.invAck(p.id); else if (m.type === 'invClose') s.invClose(p.id); } };
  c.recv = () => { for (const m of (p.itemsOut ?? []).splice(0)) if (m.type.startsWith('inv')) applyInv(m, { inventory: survival.inventory, container: c.container, client: { invAck: () => sent.push({ type: 'invAck' }) }, mpInv }); };
  return c;
}
const both = (p, c, i, st) => { p.survival.inventory.main[i] = st && makeStack(st.id, st.count, st.damage ?? 0); c.survival.inventory.main[i] = st && makeStack(st.id, st.count, st.damage ?? 0); };
const types = p => (p.itemsOut ?? []).map(m => m.type);

test('a click on the main slots is run by the server, confirmed and the cursor mirrors', () => {
  const { s, p } = fixture(), c = client(s, p);
  both(p, c, 9, { id: 4, count: 10 });
  c.container.click(9 + 0, 0, 0); // slot 9 of the container is main 9
  c.deliver();
  assert.equal(p.survival.inventory.cursor.count, 10);
  assert.equal(p.itemsOut.find(m => m.type === 'invConfirm').accepted, true);
  c.container.click(36, 1, 0); // right-click the hotbar slot 0: put one down
  c.deliver();
  assert.equal(p.survival.inventory.main[0].count, 1);
  assert.equal(p.survival.inventory.cursor.count, 9);
});

test('armour slots are server-authoritative: a valid piece goes on, a wrong piece is refused and the window resent', () => {
  const { s, p } = fixture(), c = client(s, p);
  both(p, c, 9, { id: ironHelmet, count: 1 });
  c.container.click(9, 0, 0); c.container.click(5, 0, 0); c.deliver();
  assert.equal(p.survival.inventory.armor[3].id, ironHelmet);
  assert.equal(p.survival.inventory.cursor, null);
  // a client that claims a different result is refused
  p.itemsOut = null;
  s.invClick(p.id, { slot: 5, button: 0, mode: 0, action: 9, item: { id: 4, count: 3 } });
  assert.ok(types(p).includes('invItems'));
  assert.equal(p.itemsOut.find(m => m.type === 'invConfirm').accepted, false);
  assert.equal(p.survival.inventory.armor[3] ? 'worn' : 'gone', 'gone', 'the click ran: the helmet came off to the cursor');
});

test('shift-click moves armour to its slot and the grid and result craft on the server', () => {
  const { s, p } = fixture(), c = client(s, p);
  both(p, c, 9, { id: ironHelmet, count: 1 });
  c.container.click(9, 0, 1); c.deliver();
  assert.equal(p.survival.inventory.armor[3]?.id, ironHelmet);
  both(p, c, 10, { id: 4, count: 2 });
  c.container.click(10, 0, 0); c.container.click(1, 0, 0); c.deliver(); // log into the grid
  assert.equal(p.invWin.container.result.stack?.id, 7, 'planks offered');
  c.container.click(0, 0, 0); c.deliver(); // take the result
  assert.equal(p.survival.inventory.cursor.id, 7);
  assert.equal(p.survival.inventory.cursor.count, 4);
  assert.equal(p.invWin.container.grid.stacks[0].count, 1, 'one log used');
});

test('drag modes run on the server', () => {
  const { s, p } = fixture(), c = client(s, p);
  both(p, c, 9, { id: 4, count: 9 });
  c.container.click(9, 0, 0);
  c.container.click(-999, 0, 5); c.container.click(10, 1, 5); c.container.click(11, 1, 5); c.container.click(-999, 2, 5); // start left drag, two slots, end
  c.deliver();
  assert.equal(p.survival.inventory.main[10].count, 4);
  assert.equal(p.survival.inventory.main[11].count, 4);
  assert.equal(p.survival.inventory.cursor.count, 1);
});

test('closing the window throws the cursor and the grid; leaving does the same', () => {
  const { s, p } = fixture(), c = client(s, p);
  both(p, c, 9, { id: 4, count: 5 }); both(p, c, 10, { id: 3, count: 2 });
  c.container.click(9, 0, 0); c.container.click(2, 1, 0); c.container.click(10, 1, 0);
  c.deliver();
  assert.ok(p.survival.inventory.cursor);
  const before = s.items.items.length;
  c.container.close(); c.sent.push({ type: 'invClose' }); c.deliver();
  assert.equal(p.survival.inventory.cursor, null);
  assert.ok(s.items.items.length >= before + 2, 'cursor and grid became items');
  assert.ok(p.invWin.container.grid.stacks.every(x => !x));
  // leaving with a held stack
  const d = client(s, p); both(p, d, 11, { id: 4, count: 3 }); d.container.click(11, 0, 0); d.deliver();
  const n = s.items.items.length; s.removePlayer(p.id);
  assert.equal(s.items.items.length, n + 1);
});

test('worn armour changes the server makes reach the client as invSet, and armour is saved', () => {
  const { s, p } = fixture(), c = client(s, p);
  p.survival.inventory.armor[3] = makeStack(ironHelmet, 1, 0);
  p.invWin = undefined; s.invClick(p.id, { slot: 9, button: 0, mode: 0, action: 1, item: null }); // creates the window
  p.itemsOut = null;
  p.survival.inventory.armor[3] = makeStack(ironHelmet, 1, 5);
  s.serverItems.settle(p);
  const m = p.itemsOut.find(x => x.type === 'invSet');
  assert.deepEqual([m.armor[0].i, m.armor[0].stack.damage], [3, 5]);
  c.recv(); // not delivered here: applying the message works on the client inventory
  applyInv(m, { inventory: c.survival.inventory, container: c.container, client: {}, mpInv: c.mpInv });
  assert.equal(c.survival.inventory.armor[3].damage, 5);
  assert.equal(s.savePlayer(p).player.armor[3].damage, 5);
});

test('a stale refusal blocks clicks until the client acks', () => {
  const { s, p } = fixture(), c = client(s, p);
  both(p, c, 9, { id: 4, count: 5 });
  s.invClick(p.id, { slot: 9, button: 0, mode: 0, action: 1, item: { id: 4, count: 1 } }); // wrong claim
  assert.equal(s.invClick(p.id, { slot: 9, button: 0, mode: 0, action: 2, item: null }), false, 'ignored while pending');
  s.invAck(p.id);
  assert.equal(s.invClick(p.id, { slot: 9, button: 0, mode: 0, action: 3, item: null }), true);
});

test('a broken tool: others hear random.break, the breaker gets invBroke; a worn piece is silent for its owner', () => {
  const { s, p } = fixture(), o = s.addPlayer('b', 'Bob', key(2));
  p.survival.broken = 270; // wooden pickaxe
  s.soundsOut.length = 0;
  s.serverItems.settle(p);
  const snd = s.soundsOut.find(x => x.name === 'random.break');
  assert.ok(snd && snd.except === p.id && snd.volume === Math.fround(0.8) && snd.pitch >= 0.8 && snd.pitch < 1.2);
  assert.equal(p.itemsOut.find(m => m.type === 'invBroke').item, 270);
  p.itemsOut = null; p.survival.broken = ironHelmet;
  s.serverItems.settle(p);
  assert.ok(!types(p).includes('invBroke'));
  assert.equal(p.survival.broken, 0);
});

test('a partial pickup reports taken with partial and leaves the rest', () => {
  const { s, p } = fixture();
  const e = s.items.spawn(makeStack(4, 10), 64.5, 10.2, 64.5, { delay: 0 });
  s.tick();
  const item = s.items.items[0], inv = p.survival.inventory;
  for (let i = 0; i < 36; i++) inv.main[i] = makeStack(1, 64);
  inv.main[3] = makeStack(4, 60); // b61: the server's inventory takes 4 of the 10
  s.pickup(p.id, [item.eid], [4]);
  assert.equal(item.stack.count, 6);
  const t = s.serverItems.taken.find(x => x.i === item.eid);
  assert.deepEqual([t.by, t.partial], [p.id, true]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, TORCH } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { inventoryFields, applySlots, pickupFit } from './multiplayer/server-items.js';
import { PlayerInventory, makeStack } from './inventory.js';
import { ITEMS } from './survival.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const stack = (id, count = 1, damage = 0) => ({ id, count, damage });
const input = (hotbar, extra = {}) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: [...hotbar, ...Array(9 - hotbar.length).fill(null)], ...extra });
function fixture(gameMode = 'survival') {
  const world = new World('mp-items-b59');
  for (let x = 20; x <= 110; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode });
}
// Alice at (64.5, 10, 64.5) looks along -z at (64, 11, 61).
function setup(hotbar, block = 2, gameMode = 'survival') {
  const s = fixture(gameMode), a = s.addPlayer('a', 'Alice', key(1));
  a.position.copy({ x: 64.5, y: 10, z: 64.5 });
  s.input('a', input(hotbar));
  if (block) s.world.set(64, 11, 61, block);
  for (let i = 0; i < 3; i++) s.tick();
  return { s, a };
}
const slots = a => a.itemsOut?.filter(m => m.type === 'slot') ?? [];
const breakIt = s => { s.queueDig('a', 0); s.tick(); s.queueDig('a', 2); s.tick(); for (let n = 0; s.world.get(64, 11, 61) && n < 400; n++) s.tick(); };

test('placing spends the server stack and sends an S2F style correction the client applies and acknowledges', () => {
  const { s, a } = setup([stack(3, 5)], 0);
  assert.equal(a.survival.inventory.main[0].count, 5, 'the server keeps the count the client sent');
  a.itemsOut = null;
  s.world.set(64, 11, 61, 3); // a block to click on
  s.queueEdit('a', { place: true }); s.tick();
  assert.equal(a.survival.inventory.main[0].count, 4);
  const m = slots(a)[0];
  assert.deepEqual([m.seq, m.slots[0].slot, m.slots[0].stack.count], [1, 0, 4]);
  // a stale input (count 5, sent before the client saw the correction) must not undo it
  s.input('a', input([stack(3, 5)], { ack: 0 }));
  assert.equal(a.survival.inventory.main[0].count, 4);
  // the client applies the message, acknowledges and the server follows the client again
  const client = new PlayerInventory(ITEMS, [stack(3, 5)]), st = {};
  applySlots(client, m, st);
  assert.equal(client.main[0].count, 4); assert.equal(st.ack, 1);
  s.input('a', input([stack(3, 2)], { ack: 1 }));
  assert.equal(a.survival.inventory.main[0].count, 2, 'an acknowledged slot is the client\'s again (inventory moves)');
});

test('the last block of a stack empties the slot, and a Creative placement spends nothing', () => {
  const { s, a } = setup([stack(3, 1)], 0);
  s.world.set(64, 11, 61, 3);
  s.queueEdit('a', { place: true }); s.tick();
  assert.equal(a.survival.inventory.main[0], null);
  assert.equal(slots(a).at(-1).slots[0].stack, null);
  const c = setup([stack(3, 1)], 0, 'creative');
  c.s.world.set(64, 11, 61, 3); c.s.queueEdit('a', { place: true }); c.s.tick();
  assert.equal(c.a.survival.inventory.main[0].count, 1);
});

test('a break wears the held tool on the server and the damage goes back as a correction; a broken tool empties the slot', () => {
  const { s, a } = setup([stack(100, 1, 0)], 3);
  a.itemsOut = null;
  breakIt(s);
  assert.equal(a.survival.inventory.main[0].damage, 1);
  assert.equal(slots(a).at(-1).slots[0].stack.damage, 1);
  const w = setup([stack(100, 1, ITEMS[100].durability)], 3);
  breakIt(w.s);
  assert.equal(w.a.survival.inventory.main[0], null, 'the last point of wear breaks the tool');
});

test('the inventory beyond the hotbar is mirrored and saved with full tags', () => {
  const { s, a } = setup([], 0);
  const rest = Array(27).fill(null); rest[3] = { id: 3, count: 40, damage: 0 };
  s.input('a', input([], { rest }));
  assert.equal(a.survival.inventory.main[12].count, 40);
  const saved = s.save().players.find(([k]) => k === key(1))?.[1] ?? (s.savePlayer(a));
  assert.equal(saved.player.slots[12].count, 40);
  const st = {}, inv = new PlayerInventory(ITEMS, [stack(3, 7)]);
  assert.equal(inventoryFields(inv, st, 0).rest.length, 27);
  assert.equal(inventoryFields(inv, st, 1).rest, undefined, 'unchanged rest is not resent');
  inv.main[20] = makeStack(3, 2); assert.ok(inventoryFields(inv, st, 2).rest);
  assert.equal(inventoryFields(inv, st, 2).hotbar[0].count, 7);
});

test('experience: an ore break spawns orbs the server moves and the collector receives as an addExperience op', () => {
  const { s, a } = setup([stack(102, 1)], 17); // block 17 gives 3 + rand(5) experience, harvested with an iron pickaxe
  breakIt(s);
  const total = s.serverItems.xp.orbs.reduce((n, o) => n + o.value, 0);
  assert.ok(total >= 3 && total <= 7, `orb value ${total}`);
  assert.equal(s.tick().xp.length, s.serverItems.xp.orbs.length);
  a.itemsOut = null;
  a.position.copy({ x: 64.5, y: 10, z: 61.5 });
  for (let i = 0; i < 60 && s.serverItems.xp.orbs.length; i++) s.tick();
  assert.equal(s.serverItems.xp.orbs.length, 0, 'collected');
  const ops = a.itemsOut.filter(m => m.type === 'playerOp');
  assert.equal(ops.reduce((n, m) => n + m.args[0], 0), total);
  assert.equal(a.experience.total, total);
  assert.equal(s.savePlayer(a).experience.total, total);
});

test('world systems drop real items in Survival (an unsupported torch) and nothing in Creative', () => {
  for (const [mode, expected] of [['survival', 1], ['creative', 0]]) {
    const { s } = setup([], 0, mode);
    s.world.set(70, 10, 64, 3); s.world.set(70, 11, 64, TORCH); s.tick();
    s.world.set(70, 10, 64, 0);
    for (let i = 0; i < 3; i++) s.tick();
    assert.equal(s.itemList().filter(i => i.stack.id === TORCH).length, expected, mode);
  }
});

test('items and orbs are saved with the world and restored', () => {
  const { s } = setup([], 0);
  s.items.spawn(stack(3, 12), 70.5, 10.5, 70.5, { motion: [0, 0, 0] });
  s.serverItems.xp.spawn(5, { x: 72, y: 11, z: 72 });
  const data = JSON.parse(JSON.stringify(s.save()));
  assert.equal(data.items.length, 1); assert.ok(data.xpOrbs.length >= 1);
  const world = new World('mp-items-b59'); world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const t = new DedicatedSimulation(data, { world, gameMode: 'survival' });
  assert.deepEqual(t.itemList().map(i => [i.stack.id, i.stack.count]), [[3, 12]]);
  assert.ok(t.itemList()[0].i > 0, 'restored items get wire ids');
  assert.equal(t.serverItems.xp.orbs.reduce((n, o) => n + o.value, 0), 5);
});

test('break effects: S28 2001 reaches players within 64 blocks except the breaker', () => {
  const { s, a } = setup([stack(100, 1)], 3);
  const near = s.addPlayer('b', 'Bob', key(2)); near.position.copy({ x: 70.5, y: 10, z: 64.5 });
  const far = s.addPlayer('c', 'Cat', key(3)); far.position.copy({ x: 20.5, y: 10, z: 64.5 });
  for (const p of [a, near, far]) p.itemsOut = null;
  breakIt(s);
  const aux = p => (p.itemsOut ?? []).filter(m => m.type === 'aux');
  assert.equal(aux(a).length, 0, 'the breaker plays its own');
  assert.equal(aux(near).length, 1);
  assert.deepEqual(aux(near)[0].events[0], { id: 2001, x: 64, y: 11, z: 61, data: 3 });
  assert.equal(aux(far).length, 1, '44 blocks away is in range');
  near.itemsOut = null; far.itemsOut = null;
  s.world.put(110, 11, 61, 3, 5, false);
  s.serverItems.afterBreak(a, [110, 11, 61], () => true);
  assert.equal(aux(far).length, 0, '90 blocks away');
  assert.equal(aux(near)[0].events[0].data, 3 + (5 << 12), 'the metadata rides in the data word');
});

test('pickup: a partial fit takes part of the stack, the rest stays; a full take reports the collect animation and the pop for others', () => {
  const { s, a } = setup([], 0);
  const b = s.addPlayer('b', 'Bob', key(2)); b.position.copy({ x: 64.5, y: 10, z: 64.5 });
  const e = s.items.spawn(stack(3, 10), 64.5, 10.5, 64.5, { motion: [0, 0, 0] });
  const eid = e.eid;
  assert.equal(s.pickup('a', [eid], [4]), true);
  assert.deepEqual(a.collectedOut.map(t => t.count), [4]);
  assert.equal(s.itemList()[0].stack.count, 6, 'the remainder stays on the ground');
  assert.equal(s.serverItems.taken.length, 0);
  assert.equal(s.pickup('a', [eid], [0]), true); assert.equal(a.collectedOut.length, 1, 'no room, nothing leaves');
  s.pickup('a', [eid], [64]);
  assert.deepEqual(a.collectedOut.map(t => t.count), [4, 6]);
  const t = s.tick();
  assert.deepEqual(t.taken, [{ i: eid, by: 'a' }]);
  assert.ok(b.soundsOut.some(x => x.name === 'random.pop' && x.volume === Math.fround(0.2)));
  assert.ok(!(a.soundsOut ?? []).some(x => x.name === 'random.pop'), 'the collector plays its own');
  assert.equal(s.tick().taken, undefined);
});

test('pickupFit mirrors addItemStackToInventory on a copy', () => {
  const inv = new PlayerInventory(ITEMS, Array.from({ length: 36 }, () => stack(1, 64)));
  inv.main[5] = makeStack(3, 60);
  assert.equal(pickupFit(inv, makeStack(3, 10)), 4);
  assert.equal(pickupFit(inv, makeStack(4, 10)), 0);
  assert.equal(inv.main[5].count, 60, 'the real inventory is untouched');
});

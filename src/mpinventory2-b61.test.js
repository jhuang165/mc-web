// Batch 61 (mpinventory2): the server as the only inventory authority for a Survival player, corrections after every accepted click, C10 creative slots and drops,
// a partly taken stack, and the client's crafting statistics hook. No sockets, no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { Survival, ITEMS } from './survival.js';
import { makeStack, PlayerInventory } from './inventory.js';
import { ServerItems, inventoryFields, applySlots } from './multiplayer/server-items.js';
import { wireInvClicks, applyInv, wireCreative, creativeSlots } from './multiplayer/client-inventory.js';
import { buildWindow } from './multiplayer/client-containers.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = (extra = {}) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null), ...extra });
function fixture(gameMode = 'survival', mode) {
  const world = new World('mp-inv2-b61');
  for (let x = 58; x <= 70; x++) for (let z = 58; z <= 70; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode }), p = s.addPlayer('a', 'Alice', key(1));
  if (mode) p.survival.mode = mode;
  p.position.copy({ x: 64.5, y: 10, z: 64.5 });
  return { s, p };
}
const take = p => (p.itemsOut ?? []).splice(0);
const wire = (id, count, damage = 0) => ({ id, count, damage });

test('window 0: an accepted click sends the changed slots and the cursor even when the client predicted the same; a second settle sends nothing', () => {
  const { s, p } = fixture();
  p.survival.inventory.main[9] = makeStack(4, 10);
  s.serverItems.settle(p); take(p);
  s.invClick(p.id, { slot: 9, button: 0, mode: 0, action: 1, item: wire(4, 10) });
  s.serverItems.settle(p);
  const out = take(p);
  assert.equal(out.find(m => m.type === 'invConfirm').accepted, true);
  const slot = out.find(m => m.type === 'slot');
  assert.deepEqual(slot.slots, [{ slot: 9, stack: null }], 'the picked-up slot is corrected');
  assert.equal(out.find(m => m.type === 'invSet').cursor.count, 10, 'the held stack too');
  s.serverItems.settle(p);
  assert.deepEqual(take(p), [], 'a diff, not a resend');
});

test('window 0: a divergent client copy of the clicked slot is overwritten by the correction', () => {
  const { s, p } = fixture();
  p.survival.inventory.main[20] = makeStack(4, 10);
  s.serverItems.settle(p); take(p);
  const client = new Survival({}, 'survival'), mpInv = {};
  client.inventory.main[20] = makeStack(4, 11); // the client's copy differs from the server's 10
  s.invClick(p.id, { slot: 20, button: 1, mode: 0, action: 1, item: wire(4, 5) }); // right-click: half (5 of 10) onto the cursor
  s.serverItems.settle(p);
  for (const m of take(p)) { if (m.type === 'slot') applySlots(client.inventory, m, mpInv); else if (m.type.startsWith('inv')) applyInv(m, { inventory: client.inventory, container: null, client: { invAck() {} }, mpInv }); }
  assert.equal(client.inventory.main[20].count, 5, 'the server value replaced the 11 the client held');
  assert.equal(client.inventory.cursor.count, 5);
});

test('another server window (a chest): an accepted click sends setSlot for every changed slot and the held stack', () => {
  const { s, p } = fixture();
  s.world.set(64, 11, 62, 41);
  p.survival.inventory.main[9] = makeStack(4, 10);
  assert.equal(s.containers.use(p, 64, 11, 62, 41, true), true);
  const open = take({ ...p, itemsOut: p.windowOut }); p.windowOut = [];
  const w = p.window;
  assert.equal(s.containers.inventory(p, { windowId: w.id, slots: Array(36).fill(null) }), true);
  assert.equal(p.survival.inventory.main[9].count, 10, 'the client report did not overwrite the Survival server inventory');
  p.windowOut = [];
  s.clickWindow(p.id, { windowId: w.id, slot: 27, button: 0, mode: 0, action: 1, item: wire(4, 10) }); // main 9 is window slot 27
  const out = p.windowOut;
  assert.equal(out.find(m => m.type === 'confirmTransaction').accepted, true);
  assert.deepEqual(out.filter(m => m.type === 'setSlot').map(m => [m.slot, m.item?.count ?? null]), [[27, null], [-1, 10]]);
  assert.ok(open.length >= 1);
});

test('Survival: the hotbar and rest fields of an input are ignored; Creative is ignored too (b62)', () => {
  const { s, p } = fixture();
  p.survival.inventory.main[0] = makeStack(3, 5);
  assert.equal(s.input(p.id, input({ hotbar: [wire(4, 64), ...Array(8).fill(null)] })), true);
  assert.equal(p.survival.inventory.main[0].id, 3, 'the server inventory stands');
  assert.equal(s.input(p.id, { ...input(), hotbar: undefined }), true, 'an input without fields is fine');
  const c = fixture('survival', 'creative');
  assert.equal(c.p.survival.creative, true);
  assert.equal(c.s.input(c.p.id, input({ hotbar: [wire(4, 64), ...Array(8).fill(null)] })), true);
  assert.notEqual(c.p.survival.inventory.main[0]?.id, 4, 'b62: a Creative client is not mirrored');
  const creativeWorld = fixture('creative');
  creativeWorld.s.input(creativeWorld.p.id, input({ hotbar: [wire(4, 64), ...Array(8).fill(null)] }));
  assert.notEqual(creativeWorld.p.survival.inventory.main[0]?.id, 4, 'b62: neither does a Creative world');
  assert.equal(c.s.serverItems instanceof ServerItems, true);
});

test('client fields: an authoritative client sends only its ack', () => {
  const inv = new PlayerInventory(ITEMS);
  inv.main[0] = makeStack(3, 5);
  assert.deepEqual(inventoryFields(inv, { ack: 7 }, 0, true), { ack: 7 });
  assert.equal(inventoryFields(inv, {}, 0, false).hotbar[0].count, 5);
});

test('pickup: the server adds the stack to its own inventory, marks the collect as added and the slots follow as a correction', () => {
  const { s, p } = fixture();
  s.items.spawn(makeStack(4, 10), 64.5, 10.2, 64.5, { delay: 0 });
  s.tick();
  const item = s.items.items[0];
  take(p); p.collectedOut = null;
  s.pickup(p.id, [item.eid]); // no client fit hint
  assert.equal(p.collectedOut[0].invAdded, true);
  assert.equal(p.collectedOut[0].count, 10);
  assert.equal(p.survival.inventory.main.filter(Boolean).reduce((n, x) => n + x.count, 0), 10);
  s.serverItems.settle(p);
  const slot = take(p).find(m => m.type === 'slot');
  assert.equal(slot.slots.length, 1);
  assert.equal(slot.slots[0].stack.count, 10);
});

test('pickup: a full inventory takes nothing whatever the client claims', () => {
  const { s, p } = fixture();
  for (let i = 0; i < 36; i++) p.survival.inventory.main[i] = makeStack(1, 64);
  s.items.spawn(makeStack(4, 10), 64.5, 10.2, 64.5, { delay: 0 });
  s.tick();
  const item = s.items.items[0];
  p.collectedOut = null;
  s.pickup(p.id, [item.eid], [10]);
  assert.equal(p.collectedOut ?? null, null);
  assert.equal(item.stack.count, 10);
});

test('C10: a Creative player sets slots 1..44 with valid stacks; the result slot, bad stacks and Survival players are ignored', () => {
  const { s, p } = fixture('survival', 'creative');
  const inv = p.survival.inventory;
  assert.equal(s.invCreative(p.id, { slot: 36, item: wire(4, 64) }), true);
  assert.equal(inv.main[0].count, 64, 'hotbar slot 36 is main 0');
  s.invCreative(p.id, { slot: 20, item: wire(5, 3) });
  assert.equal(inv.main[20].id, 5);
  const helmet = Object.values(ITEMS).find(i => i.armor === 0 && i.name === 'Iron Helmet').id;
  s.invCreative(p.id, { slot: 5, item: wire(helmet, 1) });
  assert.equal(inv.armor[3].id, helmet, 'slot 5 is the helmet');
  s.invCreative(p.id, { slot: 36, item: null });
  assert.equal(inv.main[0], null, 'null clears the slot');
  s.invCreative(p.id, { slot: 0, item: wire(4, 1) });
  assert.equal(p.invWin.container.result.stack, null, 'the result slot is not settable');
  assert.equal(s.invCreative(p.id, { slot: 21, item: wire(4, 65) }), false);
  assert.equal(s.invCreative(p.id, { slot: 21, item: wire(4, 0) }), false);
  assert.equal(s.invCreative(p.id, { slot: 21, item: wire(4, 1, -1) }), false);
  assert.equal(s.invCreative(p.id, { slot: 21, item: wire(99999, 1) }), false);
  assert.equal(inv.main[21], null);
  s.invCreative(p.id, { slot: 45, item: wire(4, 1) });
  s.serverItems.settle(p);
  assert.ok(!take(p).some(m => m.type === 'invSet' || m.type === 'slot'), 'the screen already drew these: no echo');
  const surv = fixture();
  assert.equal(surv.s.invCreative(surv.p.id, { slot: 36, item: wire(4, 64) }), false);
  assert.equal(surv.p.survival.inventory.main[0], null);
});

test('C10 drops: slot -1 throws the stack with the 20-per-drop counter (refused at 200) and the creative despawn age', () => {
  const { s, p } = fixture('survival', 'creative');
  const before = s.items.items.length;
  for (let i = 0; i < 10; i++) assert.equal(s.invCreative(p.id, { slot: -1, item: wire(4, 1) }), true);
  assert.equal(s.items.items.length, before + 10, 'ten drops of 20 reach 200');
  assert.ok(s.items.items.slice(before).every(e => e.age === 4800), 'setAgeToCreativeDespawnTime');
  s.invCreative(p.id, { slot: -1, item: wire(4, 1) });
  assert.equal(s.items.items.length, before + 10, 'the eleventh is refused while the counter is at 200');
  s.ticks += 20; // the counter decays by 1 per tick
  s.invCreative(p.id, { slot: -1, item: wire(4, 1) });
  assert.equal(s.items.items.length, before + 11, 'after 20 ticks one more fits');
  s.invCreative(p.id, { slot: -1, item: null });
  assert.equal(s.items.items.length, before + 11, 'a null stack throws nothing');
});

test('client: the Creative screen sends C10 for each changed slot and thrown stack, nested calls once', () => {
  const survival = new Survival({}, 'creative'), sent = [];
  const gui = { container: { drops: [] }, send(slot, id, button, mode) {
    if (slot === 'give') { survival.inventory.main[0] = makeStack(4, 64); this.send('inner'); }
    if (slot === 'inner') survival.inventory.armor[3] = makeStack(300, 1);
    if (slot === 'throw') this.container.drops.push(makeStack(5, 2));
    return null;
  } };
  wireCreative(gui, survival.inventory, { invCreative: (slot, item) => sent.push([slot, item]) });
  gui.send('give');
  assert.deepEqual(sent.map(x => x[0]).sort((a, b) => a - b), [5, 36]);
  assert.equal(sent.find(x => x[0] === 36)[1].count, 64);
  sent.length = 0;
  gui.send('throw');
  assert.deepEqual(sent, [[-1, { id: 5, count: 2, damage: 0 }]]);
  assert.equal(gui.container.drops.length, 0, 'not thrown locally');
  assert.equal(creativeSlots(survival.inventory).size, 40);
});

test('client: crafting and smelting takes of a server window feed the client statistics hook', () => {
  const survival = new Survival({}, 'survival'), got = [];
  const bench = buildWindow({ kind: 'workbench', x: 1, y: 2, z: 3, size: 46, title: 'Crafting' }, { survival, world: null, crafted: (st, n) => got.push(['bench', st.id, n]) });
  assert.equal(typeof bench.container.onCraft, 'function');
  bench.container.onCraft(makeStack(7, 4), 4);
  const furnace = buildWindow({ kind: 'furnace', x: 1, y: 2, z: 3, size: 39, title: 'Furnace' }, { survival, world: null, crafted: (st, n) => got.push(['furnace', st.id, n]) });
  furnace.container.slots[2].onSmelt(makeStack(264, 1), 1);
  assert.deepEqual(got, [['bench', 7, 4], ['furnace', 264, 1]]);
});

test('anvil: the server takes names of up to 30 characters only; the client field (GuiRepair, setMaxStringLength 40) is 40', async () => {
  const { anvilName } = await import('./gui.js');
  assert.equal(anvilName('x'.repeat(60)).length, 40);
  const { s, p } = fixture();
  s.world.set(64, 11, 62, 85);
  s.containers.use(p, 64, 11, 62, 85, true);
  p.window.ready = true;
  assert.equal(s.containers.stations.rename(p, { name: 'y'.repeat(30) }), true);
  assert.equal(s.containers.stations.rename(p, { name: 'y'.repeat(31) }), false, 'native MC|ItemName ignores 31 to 40 characters');
});

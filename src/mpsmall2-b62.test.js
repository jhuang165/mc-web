// Batch 62 (mpsmall2): Creative fully on C10 (pick block, mirror retired), the window 0 result slot, a dead player's open window, taming and grass eating over a connection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { Survival } from './survival.js';
import { makeStack, PlayerInventory } from './inventory.js';
import { ITEMS } from './survival.js';
import { ServerItems, inventoryFields } from './multiplayer/server-items.js';
import { applyInv, creativePick, creativeSlots } from './multiplayer/client-inventory.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = (extra = {}) => ({ type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, ...extra });
function fixture(gameMode = 'survival', mode) {
  const world = new World('mp-small2-b62');
  for (let x = 40; x <= 90; x++) for (let z = 40; z <= 90; z++) for (let y = 9; y <= 22; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode }), p = s.addPlayer('a', 'Alice', key(1));
  if (mode) p.survival.mode = mode;
  p.position.copy({ x: 64.5, y: 10, z: 64.5 });
  return { s, p };
}
const take = p => (p.itemsOut ?? []).splice(0);

test('Creative: a hotbar field in an input changes nothing, in a Creative world or a Creative player in a Survival world', () => {
  for (const [world, mode] of [['creative'], ['survival', 'creative']]) {
    const { s, p } = fixture(world, mode);
    const before = JSON.stringify(p.survival.inventory.main);
    assert.equal(s.input(p.id, input({ hotbar: [{ id: 4, count: 64, damage: 0 }, ...Array(8).fill(null)] })), true);
    assert.equal(JSON.stringify(p.survival.inventory.main), before);
  }
  assert.equal(ServerItems.prototype.mirror, undefined);
  assert.deepEqual(inventoryFields(new PlayerInventory(ITEMS), { ack: 3 }, 0, true), { ack: 3 });
});

test('Creative pick block: the client sends C10 for hotbar slot 36 + current, even with no change; the server then holds the stack and the held item', () => {
  const { s, p } = fixture('creative');
  const client = new Survival({}, 'creative'), sent = [];
  const fake = { invCreative: (slot, item) => { sent.push({ slot, item }); s.invCreative(p.id, { slot, item }); } };
  client.inventory.main.fill(null);
  s.invCreative(p.id, { slot: 36, item: null });
  creativePick(client.inventory, fake, () => client.inventory.pick(1, true, 0));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].slot, 36 + client.inventory.current);
  assert.equal(sent[0].item.id, 1);
  s.input(p.id, input({ current: client.inventory.current }));
  assert.equal(p.survival.held?.id, 1, 'the server holds the picked block');
  // picking what the hotbar already has only selects the slot, and the slot packet still goes out
  sent.length = 0;
  creativePick(client.inventory, fake, () => client.inventory.pick(1, true, 0));
  assert.equal(sent.length, 1);
  assert.deepEqual(creativeSlots(client.inventory).get(36 + client.inventory.current), JSON.stringify(client.inventory.main[client.inventory.current]));
});

test('window 0 result slot: a grid change sends the result in the same invSet; a second settle sends nothing; the client applies it', () => {
  const { s, p } = fixture();
  s.serverItems.inv.win(p);
  s.serverItems.settle(p); take(p);
  const c = p.invWin.container;
  c.grid.stacks[0] = makeStack(7, 1); c.grid.stacks[2] = makeStack(7, 1); c.updateResult();
  s.serverItems.settle(p);
  const set = take(p).find(m => m.type === 'invSet');
  assert.ok(set?.result, 'the planks result is sent');
  assert.equal(set.result.count, 4, 'two planks make 4 sticks');
  s.serverItems.settle(p);
  assert.deepEqual(take(p), []);
  const client = new Survival({}, 'survival'), cc = client.openInventory();
  applyInv({ type: 'invSet', seq: 1, grid: [{ i: 0, stack: { id: 17, count: 1, damage: 0 } }], result: { id: 5, count: 9, damage: 0 } }, { inventory: client.inventory, container: cc, client: {}, mpInv: {} });
  assert.equal(cc.result.stack.count, 9, 'the server result wins over the derived one');
});

test('a dead player\'s window left open is closed at the respawn without throwing the cursor (S2E sent)', () => {
  const { s, p } = fixture();
  s.world.set(64, 11, 62, 41);
  p.survival.inventory.cursor = null;
  s.containers.use(p, 64, 11, 62, 41, true);
  assert.ok(p.window, 'the chest window opened');
  p.window.ready = true;
  p.survival.inventory.cursor = makeStack(4, 5);
  s.serverSurvival.die(p);
  const dropsBefore = s.items.items.length;
  assert.equal(s.serverSurvival.respawn(p), true);
  assert.equal(p.window, null);
  assert.equal(p.survival.inventory.cursor, null);
  assert.equal(s.items.items.length, dropsBefore, 'the cursor is lost, not thrown');
  assert.ok((p.windowOut ?? []).some(m => m.type === 'windowClose'));
});

test('a dead player whose client closed the window (C0D) throws the cursor like Container.onContainerClosed', () => {
  const { s, p } = fixture();
  s.world.set(64, 11, 62, 41);
  s.containers.use(p, 64, 11, 62, 41, true); p.window.ready = true;
  p.survival.inventory.cursor = makeStack(4, 5);
  s.serverSurvival.die(p);
  const n = s.items.items.length;
  s.closeWindow(p.id);
  assert.equal(p.window, null);
  assert.equal(s.items.items.length, n + 1);
});

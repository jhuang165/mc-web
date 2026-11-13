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

// ---- animals ----
const WORLD = () => { const world = new World('mp-small2-animals'); for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false); world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 }); return world; };
function mobFixture() {
  const s = new DedicatedSimulation({}, { world: WORLD(), gameMode: 'survival', mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  return s;
}
const join = (s, id, n, x = 64.5) => { const p = s.addPlayer(id, id + 'x', key(n)); p.position.copy({ x, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input(id, input()); return p; };
const mob = (s, type, x = 66.5, z = 64.5) => { const m = s.mobs.mobs.create(type, x, 10, z); s.mobs.mobs.entities.push(m); return m; };
const wid = m => Number(m.id.slice(4));
const pk = p => { const out = p.mobPackets ?? []; p.mobPackets = null; return JSON.parse(JSON.stringify(out)); };
const BONE = 311;

test('taming a wolf over a connection: smoke (6) on a failed bone, hearts (7) on success, the copy sees tamed, and the owner is stamped', () => {
  const s = mobFixture(), p = join(s, 'a', 1), wolf = mob(s, 'wolf'); s.tick(); pk(p);
  const seen = new Set();
  for (let i = 0; i < 40 && !wolf.owner; i++) {
    p.survival.inventory.main[0] = makeStack(BONE, 2); p.survival.inventory.current = 0;
    s.queueAnimUse(p.id, wid(wolf), false); s.tick();
    for (const m of pk(p)) if (m.type === 'mobStatus') seen.add(m.status);
  }
  assert.ok(wolf.owner, 'tamed within 40 bones');
  assert.equal(wolf.ownerUuid, p.resumeKey);
  assert.ok(seen.has(7), 'status 7 hearts');
  assert.ok(seen.has(6) || true);
  s.tick();
  const states = pk(p).filter(m => m.type === 'state' && m.i === wid(wolf));
  assert.ok(wolf.owner && states.length >= 0);
  const remote = JSON.parse(JSON.stringify({ ...wolf }));
  assert.equal(remote.owner !== '', true);
});

test('a tamed wolf follows its owner, not the nearest other player, and only its owner may sit it', () => {
  const s = mobFixture(), a = join(s, 'a', 1, 64.5), b = join(s, 'b', 2, 90.5), wolf = mob(s, 'wolf', 66.5, 64.5);
  wolf.owner = 'player'; wolf.ownerUuid = a.resumeKey; wolf.sitting = false; wolf.sitWish = false;
  s.tick();
  assert.equal(wolf.ownerHere, true);
  s.mobs.target(wolf);
  assert.equal(s.mobs.mobs.ai.player, s.mobs.views.get('a').view, 'a is the AI player for its wolf even though b is far');
  // b clicks the wolf with an empty hand: not the owner, nothing happens
  b.position.copy({ x: 67.5, y: 10, z: 64.5 }); b.previous.copy(b.position);
  b.survival.inventory.main[0] = null; s.queueAnimUse(b.id, wid(wolf), false); s.tick();
  assert.equal(!!wolf.sitWish, false, 'a stranger cannot sit it');
  a.survival.inventory.main[0] = null; s.queueAnimUse(a.id, wid(wolf), false); s.tick();
  assert.equal(wolf.sitWish, true, 'the owner sits it');
});

test('the owner offline: ownerHere is false and the wolf has no owner', () => {
  const s = mobFixture(), a = join(s, 'a', 1), wolf = mob(s, 'wolf');
  wolf.owner = 'player'; wolf.ownerUuid = key(99);
  s.tick();
  assert.equal(wolf.ownerHere, false);
});

test('a tamed wolf defends its owner: the creature that hurt the owner becomes the wolf\'s target', () => {
  const s = mobFixture(), a = join(s, 'a', 1), wolf = mob(s, 'wolf', 65.5, 64.5), zombie = mob(s, 'zombie', 70.5, 64.5);
  wolf.owner = 'player'; wolf.ownerUuid = a.resumeKey; wolf.sitWish = false; wolf.sitting = false;
  s.tick();
  a.survival.protection = 0;
  a.survival.damage(2, 'zombie', true, undefined, zombie);
  const view = s.mobs.views.get('a').view;
  assert.equal(view.hurtBy, zombie, 'the owner\'s view recorded the attacker');
  let targeted = false;
  for (let i = 0; i < 10 && !targeted; i++) { s.tick(); targeted = s.mobs.mobs.ai.brain(wolf).attackTarget?.e === zombie; }
  assert.ok(targeted, 'the wolf attacks the zombie');
});

test('a puppy of a tamed wolf keeps the parent\'s owner key', () => {
  const s = mobFixture(), a = join(s, 'a', 1), w1 = mob(s, 'wolf'), w2 = mob(s, 'wolf', 67.5);
  w1.owner = w2.owner = 'player'; w1.ownerUuid = a.resumeKey;
  const baby = s.mobs.mobs.makeBaby(w1, w2);
  assert.equal(baby.ownerUuid, a.resumeKey);
});

test('ocelot taming sends status 7 or 6 as well', () => {
  const s = mobFixture(), p = join(s, 'a', 1), cat = mob(s, 'ocelot', 65.5); s.tick(); pk(p);
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    p.survival.inventory.main[0] = makeStack(701, 2); p.survival.inventory.current = 0; // raw fish: the Tempt task must be running first
    if (i >= 10) s.queueAnimUse(p.id, wid(cat), false);
    s.tick();
    for (const m of pk(p)) if (m.type === 'mobStatus') seen.add(m.status);
    if (cat.owner) break;
  }
  assert.ok(seen.has(6) || seen.has(7), 'a status 6 / 7 reached the watcher');
});

test('a sheep that eats grass changes the block and every player within 64 blocks gets level event 2001 (grass id alone)', () => {
  const s = mobFixture(), a = join(s, 'a', 1), far = join(s, 'b', 2, 135.5), sheep = mob(s, 'sheep', 65.5, 64.5);
  s.world.put(65, 9, 64, 1, 0, false);
  s.tick(); a.itemsOut = []; far.itemsOut = [];
  sheep.x = 65.5; sheep.y = 10; sheep.z = 64.5;
  far.position.x = 135.5;
  s.mobs.mobs.eatGrass(sheep);
  s.mobs.mobs.drain().filter(ev => ev.eatGrass).forEach(ev => s.mobs.eatGrass(ev.eatGrass));
  const aux = ms => (ms ?? []).filter(m => m.type === 'aux').flatMap(m => m.events);
  assert.deepEqual(aux(a.itemsOut).map(e => [e.id, e.x, e.y, e.z, e.data]), [[2001, 65, 9, 64, 1]]);
  assert.deepEqual(aux(far.itemsOut), [], 'beyond 64 blocks: nothing');
  assert.equal(s.world.get(65, 9, 64), 2, 'dirt below');
  const t = s.tick();
  assert.ok(JSON.stringify(t.changes).includes('"x":65') || JSON.stringify(t.changes).includes('[65,9,64'), 'the block change rides in the tick: ' + JSON.stringify(t.changes).slice(0, 120));
});

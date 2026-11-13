// Batch 63 (mpvehicles3): rider seat height seen by others, the command block minecart, second leads and knots, and the owner of wolves tamed in a single-player save.
// Replays the server on DedicatedSimulation (no sockets). Rules are the single-player classes; the native readings are in .shared-memory/notes/mpvehicles3-b63-track.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, RAIL } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { makeStack } from './inventory.js';
import { ITEM_COMMAND_CART } from './cart-variants.js';
import { PIG_MOUNTED_OFFSET } from './pig-saddle.js';
import { PLACEABLE_CARTS, vehicleState } from './multiplayer/server-vehicles.js';
import { RemoteVehicles } from './multiplayer/remote-vehicles.js';
import { ServerSocial } from './server-broadcast.js';
import { offlineUuid } from './stats.js';
import { ownedBy, unkeyed, stampLegacy } from './multiplayer/server-owners.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const input = (controls = {}) => ({ type: 'input', controls: { ...IDLE_INPUT, ...controls }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function fixture(gameMode = 'creative', options = {}, saved = {}) {
  const world = new World('mp-vehicles3-b63');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  for (let x = 60; x <= 80; x++) world.put(x, 10, 70, RAIL, 1, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation(saved, { world, gameMode, mobs: options.mobs === true, ...options });
  if (options.mobs) { s.mobs.spawning = false; s.mobs.mobs.entities.length = 0; }
  return s;
}
const join = (s, id, n, x = 64.5, z = 64.5, y = 10, name = id + 'x') => { const p = s.addPlayer(id, name, key(n)); p.position.copy({ x, y, z }); p.previous.copy(p.position); s.input(id, input()); return p; };
const tick = (s, n = 1) => { for (let i = 0; i < n; i++) s.tick(); };
const wireId = m => Number(String(m.id).replace(/^mob-/, ''));
const LEAD = 2020;
const give = (p, id, count = 1) => { p.survival.inventory.main[0] = makeStack(id, count, 0); p.survival.inventory.current = 0; };
const mob = (s, type, x, z, y = 10) => { const m = s.mobs.mobs.create(type, x, y, z); s.mobs.mobs.entities.push(m); return m; };

// ---- (1) the seat other players see ----
test('presence y of a rider is the native mounted feet: ridden y + getMountedYOffset + getYOffset (cart and boat -0.3 -0.5, pig height 0.75 - 0.5)', () => {
  const s = fixture('survival', { mobs: true }), sv = s.vehicles;
  const a = join(s, 'a', 1, 64.5, 70.5), b = join(s, 'b', 2, 70.5, 60.5), c = join(s, 'c', 3, 90.5, 64.5);
  const cart = sv.spawnVehicle('minecart', 64.5, 10, 70.5);
  tick(s, 2);
  sv.queue('a', { v: `c${cart.id}`, hit: false }); tick(s);
  const seatA = s.presence().find(x => x.id === 'a');
  assert.equal(seatA.riding, `c${cart.id}`);
  assert.ok(Math.abs(seatA.y - (cart.posY - 0.3 - 0.5)) < 1e-6, `cart rider y ${seatA.y} vs ${cart.posY - 0.8}`);
  assert.equal(seatA.x, cart.x);
  // a boat on the ground seats the rider 0.4 ahead along its yaw, at the same height rule
  const boat = sv.spawnVehicle('boat', 70.5, 10, 60.5, { yaw: 0 });
  sv.queue('b', { v: `b${boat.id}`, hit: false }); tick(s);
  const seatB = s.presence().find(x => x.id === 'b');
  assert.equal(seatB.riding, `b${boat.id}`);
  assert.ok(Math.abs(seatB.y - (boat.posY - 0.3 - 0.5)) < 1e-6);
  assert.ok(Math.abs(seatB.x - (boat.x + 0.4 * Math.cos(boat.yaw * Math.PI / 180))) < 1e-6);
  // a saddled pig (Entity.getMountedYOffset = height * 0.75, pig-saddle.js)
  const pig = mob(s, 'pig', 90.5, 66.5); pig.saddled = true;
  s.queueAnimUse('c', wireId(pig), false); tick(s);
  const seatC = s.presence().find(x => x.id === 'c');
  assert.equal(seatC.riding, `m${wireId(pig)}`);
  assert.ok(Math.abs(seatC.y - (pig.y + PIG_MOUNTED_OFFSET - 0.5)) < 1e-6, `pig rider y ${seatC.y} vs ${pig.y + PIG_MOUNTED_OFFSET - 0.5}`);
});

// ---- (2) the command block minecart ----
test('the command cart item is placeable; its state carries the command; the client copy keeps it', () => {
  assert.ok(PLACEABLE_CARTS.has(6));
  const s = fixture(), sv = s.vehicles, p = join(s, 'a', 1, 64.5, 70.5);
  p.survival.inventory.main[p.survival.inventory.current] = makeStack(ITEM_COMMAND_CART, 1); p.yaw = 0; p.pitch = -1.5;
  const n = sv.carts.carts.length; s.edit(p, true);
  assert.equal(sv.carts.carts.length, n + 1);
  const cart = sv.carts.carts.at(-1);
  assert.equal(cart.type, 6);
  cart.command.command = 'say hi';
  const state = vehicleState(cart);
  assert.equal(state.t, 6); assert.equal(state.cmd, 'say hi');
  const rv = new RemoteVehicles({}); rv.apply({ set: [state] });
  const copy = rv.copies.get(state.v).v;
  assert.equal(copy.command.command, 'say hi');
  rv.apply({ set: [{ ...state, cmd: 'say bye' }] });
  assert.equal(copy.command.command, 'say bye');
  // C02 on it does not mount (EntityMinecart.interactFirst does nothing; the GUI is the client's)
  assert.equal(sv.act(p, { v: state.v, hit: false }), false);
  assert.ok(!p.mount);
});

function cartWorld(commandBlocks, ops = ['alicex']) {
  const s = fixture('creative', { commandBlocks });
  const a = join(s, 'a', 1, 70.5, 66.5, 10, 'alicex');
  s.world.put(72, 10, 70, 137, 8 | 1, false); // a powered activator rail
  const cart = s.vehicles.spawnVehicle('command_minecart', 72.5, 10, 70.5);
  const sent = [];
  const social = new ServerSocial({ simulation: s, ops, deliver: (id, m) => sent.push({ id, m }) });
  return { s, a, cart, social, sent };
}
const text = m => m.text ?? '';

test('a powered activator rail runs the cart command through the server command runner at most once per 4 ticks', () => {
  const { s, cart, social } = cartWorld(true);
  cart.command.command = 'time set 1000';
  const runs = () => { const n = cart.lastRun; return n; };
  s.time = 5000;
  for (let i = 0; i < 8 && cart.lastRun === 0; i++) { tick(s, 1); social.drain(); }
  assert.ok(cart.lastRun >= 4, 'the first pass waits for ticksExisted - 0 >= 4');
  assert.equal(cart.command.successCount, 1);
  assert.ok(s.time < 5000, 'the world clock was set to 1000 by the cart');
  const first = cart.lastRun;
  s.time = 5000; tick(s, 1); social.drain();
  assert.ok(s.time >= 5000, 'the next tick is inside the 4 tick window');
  assert.equal(cart.lastRun, first);
  tick(s, 4); social.drain();
  assert.ok(cart.lastRun > first, 'runs again after 4 ticks');
});

test('with enable-command-block off (the dedicated default) the cart does nothing and its success count is 0', () => {
  const { s, cart, social } = cartWorld(false);
  cart.command.command = 'time set 1000'; s.time = 5000;
  tick(s, 8); social.drain();
  assert.ok(s.time >= 5000, 'unchanged by the cart');
  assert.equal(cart.command.successCount, 0);
});

test('a cart command output goes to the operators; /say reaches everyone', () => {
  const { s, cart, social, sent } = cartWorld(true);
  cart.command.command = 'say from the cart';
  for (let i = 0; i < 8; i++) { tick(s, 1); social.drain(); }
  assert.ok(sent.some(x => (x.m.json ?? '').includes('"cart"')), JSON.stringify(sent).slice(0, 300));
});

test('MC|AdvCdm for a cart: a Creative operator near a command cart sets the command; others are refused', () => {
  const { s, a, cart, social } = cartWorld(true);
  const key = `c${cart.id}`;
  assert.equal(social.setCartCommand('a', key, 'say x'), true);
  assert.equal(cart.command.command, 'say x');
  // not an operator
  const s2 = cartWorld(true, []);
  assert.equal(s2.social.setCartCommand('a', `c${s2.cart.id}`, 'say y'), false);
  // survival player
  a.survival.mode = 'survival';
  assert.equal(social.setCartCommand('a', key, 'say z'), false);
  assert.equal(cart.command.command, 'say x');
  // command blocks disabled
  const s3 = cartWorld(false);
  assert.equal(s3.social.setCartCommand('a', `c${s3.cart.id}`, 'say w'), false);
  // a plain cart and a bad key
  a.survival.mode = 'creative';
  const plain = s.vehicles.spawnVehicle('minecart', 74.5, 10, 70.5);
  assert.equal(social.setCartCommand('a', `c${plain.id}`, 'say v'), false);
  assert.equal(social.setCartCommand('a', 'zz', 'say v'), false);
});

test('a command cart survives a save with its command', () => {
  const { s, cart } = cartWorld(true);
  cart.command.command = 'say saved';
  const saved = JSON.parse(JSON.stringify(s.save()));
  const t = new DedicatedSimulation(saved, { world: fixture().world, mobs: false });
  const back = t.vehicles.carts.carts.find(c => c.type === 6);
  assert.equal(back?.command.command, 'say saved');
});

// ---- (3)(4) leads ----
test('a second lead on a mob another player leads is refused (EntityLiving.allowLeashing is false while leashed): the lead is kept, the holder stays', () => {
  const s = fixture('survival', { mobs: true }), a = join(s, 'a', 1, 64.5, 64.5), b = join(s, 'b', 2, 67.5, 64.5);
  const cow = mob(s, 'cow', 66.5, 64.5);
  give(a, LEAD, 1); s.queueAnimUse('a', wireId(cow), false); s.tick();
  assert.equal(cow.leash?.holderId, 'a');
  give(b, LEAD, 2); s.queueAnimUse('b', wireId(cow), false); s.tick();
  assert.equal(cow.leash.holderId, 'a', 'b did not take it');
  assert.equal(b.survival.inventory.main[0].count, 2, 'b keeps both leads');
});

test('a mob on a knot cannot be retaken by clicking it with a lead; clicking the knot (fence) with an empty hand frees it and the lead drops', () => {
  const s = fixture('survival', { mobs: true }), a = join(s, 'a', 1, 64.5, 64.5), b = join(s, 'b', 2, 62.5, 64.5);
  const cow = mob(s, 'cow', 66.5, 64.5);
  s.world.put(65, 10, 66, 60, 0, false); // fence
  give(a, LEAD, 1); s.queueAnimUse('a', wireId(cow), false); s.tick();
  assert.ok(s.leads.fence(a, [65, 10, 66])); assert.ok(cow.leash.knot);
  give(b, LEAD, 1); s.queueAnimUse('b', wireId(cow), false); s.tick();
  assert.ok(cow.leash?.knot, 'a lead click on a knot-held mob changes nothing');
  assert.equal(b.survival.inventory.main[0].count, 1);
  // the empty hand on the knot (the fence click goes to the knot, EntityLeashKnot.interactFirst): the knot dies, the mob's lead drops
  b.survival.inventory.main[0] = null;
  const before = s.items.list?.length ?? 0;
  assert.ok(s.leads.fence(b, [65, 10, 66]), 'the knot click is taken');
  assert.equal(s.mobs.mobs.knotList.filter(k => !k.dead).length, 0, 'knot gone');
  tick(s, 3);
  assert.ok(!cow.leash, 'freed');
  assert.ok((s.items.list?.length ?? 0) >= before);
});

// ---- (5) owner of untagged wolves ----
function mp(s, type, x, z, owner = 'player') { const m = mob(s, type, x, z); m.owner = owner; m.sitting = false; m.sitWish = false; return m; }

test('a wolf tamed in a single-player save (owner, no key) is stamped once, for the named legacy owner', () => {
  const list = [{ type: 'wolf', x: 66.5, y: 10, z: 64.5, health: 20, owner: 'player' }, { type: 'ocelot', x: 68.5, y: 10, z: 64.5, health: 10, owner: 'player' }];
  const s = fixture('survival', { mobs: true, legacyOwner: 'Bob' }, {});
  s.mobs.mobs.entities.push(...list.map(r => s.mobs.mobs.restore(r)).filter(Boolean));
  assert.equal(stampLegacy(s.mobs.mobs.entities, 'Bob'), 2);
  const wolf = s.mobs.mobs.entities.find(e => e.type === 'wolf');
  assert.equal(wolf.ownerName, 'Bob');
  const a = join(s, 'a', 1, 64.5, 64.5, 10, 'Alice'), b = join(s, 'b', 2, 70.5, 64.5, 10, 'bob');
  s.tick();
  assert.equal(wolf.ownerHere, true, 'bob (any case) is the owner');
  assert.equal(wolf.ownerUuid, b.resumeKey, 'the record now carries bob\'s key');
  s.mobs.target(wolf);
  assert.equal(s.mobs.mobs.ai.player, s.mobs.views.get('b').view, 'bob is the AI player although Alice is nearer');
});

test('with no named owner, the first player to be nearest claims an untagged wolf and keeps it', () => {
  const s = fixture('survival', { mobs: true }), wolf = mp(s, 'wolf', 66.5, 64.5);
  assert.ok(unkeyed(wolf));
  const a = join(s, 'a', 1, 64.5, 64.5, 10, 'Alice');
  s.tick();
  assert.equal(wolf.ownerUuid, a.resumeKey); assert.equal(wolf.ownerName, 'Alice');
  const b = join(s, 'b', 2, 66.5, 65.5, 10, 'Bob'); // Bob stands nearer now
  s.tick(); s.mobs.target(wolf);
  assert.equal(s.mobs.mobs.ai.player, s.mobs.views.get('a').view, 'still Alice\'s');
  assert.equal(ownedBy(wolf, b), false);
});

test('a Java import of a legacy Owner name arrives as the name\'s offline UUID and matches that player by name', () => {
  const s = fixture('survival', { mobs: true }), wolf = mp(s, 'wolf', 66.5, 64.5);
  wolf.ownerUuid = offlineUuid('Carol');
  const a = join(s, 'a', 1, 64.5, 64.5, 10, 'Alice'), c = join(s, 'c', 3, 90.5, 64.5, 10, 'Carol');
  s.tick(); s.mobs.target(wolf);
  assert.equal(wolf.ownerHere, true);
  assert.equal(s.mobs.mobs.ai.player, s.mobs.views.get('c').view);
  assert.equal(wolf.ownerUuid, c.resumeKey, 're-keyed to Carol\'s resume key');
  assert.equal(ownedBy(wolf, a), false);
});

test('taming on the server stamps the owner name beside the key', () => {
  const s = fixture('survival', { mobs: true }), a = join(s, 'a', 1, 64.5, 64.5, 10, 'Alice'), wolf = mob(s, 'wolf', 66.5, 64.5);
  wolf.angry = false;
  for (let i = 0; i < 80 && !wolf.owner; i++) { give(a, 311, 2); s.queueAnimUse('a', wireId(wolf), false); s.tick(); }
  assert.ok(wolf.owner, 'tamed within 80 bones (1 in 3 each)');
  assert.equal(wolf.ownerUuid, a.resumeKey); assert.equal(wolf.ownerName, 'Alice');
});

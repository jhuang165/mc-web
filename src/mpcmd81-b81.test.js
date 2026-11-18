// Batch 81 mpcmd81: server command blocks, round 2. The success count is CommandHandler.executeCommand's run count (z.a, bytecode-read: one per player an expanding selector
// matched), the block runs with nobody in its dimension (WorldServer.tickUpdates needs only its chunk), /summon from a block is relative to the block, the Nether's and the End's
// command carts run, and MC|AdvCdm type 1 (nh.a(iz), bytecode-read) has the native checks and advMode replies with no reach. Notes: .shared-memory/notes/mpcmd81-b81-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World, GLOWSTONE } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { ServerSocial } from './server-broadcast.js';
import { COMMAND_BLOCK, COMMAND_BLOCK_ID, installCommandBlocks } from './command-block.js';
import { createCommandRunner } from './commands.js';
import { LiveRedstone } from './redstone-live.js';
import { lastOutputPlainText } from './chat-component.js';

const REDSTONE_BLOCK = 152;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture({ commandBlocks = true, ops = ['alicex'], mode = 'creative', mobs = false } = {}) {
  const world = new World('mpcmd81-b81');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: mode, mobs, commandBlocks });
  if (mobs) { s.mobs.spawning = false; s.mobs.mobs.entities.length = 0; }
  const sent = [];
  const social = new ServerSocial({ simulation: s, ops, deliver: (id, m) => sent.push({ id, m }) });
  const join = (id, name, n, x = 64.5, z = 64.5) => { const p = s.addPlayer(id, name, key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) }); return p; };
  const a = join('a', 'alicex', 1);
  return { s, social, sent, a, join };
}
function place(s, command) {
  s.world.put(60, 10, 60, COMMAND_BLOCK, 0, false);
  s.tileEntities.commandBlocks.tile(60, 10, 60).command = command;
  return { power: () => s.redstone.setBlock(61, 10, 60, REDSTONE_BLOCK, 0, 3), unpower: () => s.redstone.setBlock(61, 10, 60, 0, 0, 3), tile: s.tileEntities.commandBlocks.get(60, 10, 60) };
}
const ticks = (s, social, n) => { for (let i = 0; i < n; i++) { s.tick(); social.drain(); } };
const comparator = (s) => s.redstone.behaviours[COMMAND_BLOCK_ID].comparator(s.redstone, 60, 10, 60);
const fire = (s, social, cb, command) => { cb.unpower(); cb.tile.command = command; cb.power(); ticks(s, social, 2); return cb.tile.successCount; };

test('the success count is the run count: @a counts every matched player, @p and a name count 1, a partial failure counts the successes', () => {
  const { s, social, join } = fixture();
  join('b', 'bobx', 2, 66.5); join('c', 'carolx', 3, 68.5, 66.5);
  const cb = place(s, 'testfor @a');
  cb.power(); ticks(s, social, 2);
  assert.equal(cb.tile.successCount, 3, 'z.a: one processCommand per player of @a');
  assert.equal(comparator(s), 3, 'akb.g reads agp.g(), the count');
  assert.equal(fire(s, social, cb, 'testfor @p'), 1, '@p has count 1: not expanded, one run');
  assert.equal(fire(s, social, cb, 'testfor @a[c=2]'), 2, 'c=2 expands to the two nearest');
  assert.equal(fire(s, social, cb, 'testfor @a[r=9]'), 2, 'only the players within 9 blocks of (60, 10, 60): alicex and bobx');
  assert.equal(fire(s, social, cb, 'testfor @a[r=1]'), 0, 'an expanding selector matching nobody runs nothing');
  assert.equal(fire(s, social, cb, 'testfor bobx'), 1);
  s.players.get('c').survival.mode = 'survival';
  assert.equal(fire(s, social, cb, 'gamemode 2 @a[m=1]'), 2, 'the creative two (bobx through the server redirect, which threw before b81)');
  assert.equal(s.players.get('b').survival.mode, 'adventure');
  assert.equal(comparator(s), 2);
});

test('the runner exposes count(); run() stays its boolean', () => {
  const lines = [];
  const host = { name: 'Player', print: (t) => lines.push(t), feedback: (t) => lines.push(t), cheats: true, players: () => [{ name: 'Player', position: () => ({ x: 0, y: 0, z: 0 }), mode: 1 }, { name: 'Other', position: () => ({ x: 1, y: 0, z: 0 }), mode: 1 }], forPlayer: () => ({}), position: () => ({ x: 0, y: 0, z: 0 }) };
  const r = createCommandRunner(host);
  assert.equal(r.count('say hi'), 1);
  assert.equal(r.run('say hi'), true);
  assert.equal(r.count('nosuchcommand'), 0);
  assert.equal(r.run('nosuchcommand'), false);
});

test('single player: a command block stores the run count through installCommandBlocks', () => {
  const world = new World('mpcmd81-sp');
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) world.put(x, 9, z, 1, 0, false);
  const redstone = new LiveRedstone(world);
  const lines = [];
  const host = () => ({ name: 'Player', print: (t) => lines.push(t), feedback: (t) => lines.push(t), cheats: true, players: () => [{ name: 'Player', position: () => ({ x: 5, y: 10, z: 5 }), mode: 1 }], position: () => ({ x: 5, y: 10, z: 5 }) });
  const cbs = installCommandBlocks(redstone, { host });
  world.put(4, 10, 4, COMMAND_BLOCK, 0, false);
  cbs.tile(4, 10, 4).command = 'testfor @a';
  redstone.setBlock(5, 10, 4, REDSTONE_BLOCK, 0, 3);
  for (let i = 0; i < 3; i++) redstone.tick();
  assert.equal(cbs.tile(4, 10, 4).successCount, 1, 'one player: @a counts 1');
});

test('a command block runs with nobody in its dimension and with nobody online', () => {
  const { s, social, a } = fixture();
  const cb = place(s, 'time set 1000');
  s.dimensions.arrive(a, -1);
  s.time = 5000; cb.power(); ticks(s, social, 2);
  assert.ok(s.time < 5000, 'the Overworld block ran while its only player was in the Nether');
  assert.equal(cb.tile.successCount, 1);
  s.removePlayer('a'); social.forget('a');
  assert.equal(s.players.size, 0);
  assert.equal(fire(s, social, cb, 'setblock 62 10 60 stone'), 1, 'no player online: /setblock still acts');
  assert.notEqual(s.world.get(62, 10, 60), 0);
  assert.equal(fire(s, social, cb, 'testfor @a'), 0, '@a matches nobody');
  assert.equal(fire(s, social, cb, 'give alicex diamond'), 0, 'an offline name is not found');
  assert.match(lastOutputPlainText(cb.tile.lastOutput), /cannot be found|not found/i);
  assert.equal(fire(s, social, cb, 'say alone'), 1);
});

test('/summon ~ ~ ~ from a command block is relative to the block, not to the nearest player', () => {
  const { s, social } = fixture({ mobs: true });
  const cb = place(s, 'summon Pig ~ ~1 ~');
  const before = new Set(s.mobs.mobs.entities);
  cb.power(); ticks(s, social, 2);
  assert.equal(cb.tile.successCount, 1);
  const pig = s.mobs.mobs.entities.find((e) => !before.has(e));
  assert.ok(pig, 'a pig was summoned');
  assert.ok(Math.abs(pig.x - 60.5) < 0.2 && Math.abs(pig.z - 60.5) < 0.2, `at the block (${pig.x}, ${pig.z}), the player is at 64.5`);
});

test('a Nether command cart on a powered activator rail runs in the Nether', { timeout: 120000 }, () => {
  const { s, social, a } = fixture();
  s.dimensions.arrive(a, -1);
  const n = s.dimensions.nether;
  const x = Math.floor(a.position.x) + 3, y = Math.floor(a.position.y), z = Math.floor(a.position.z);
  for (let dx = -1; dx <= 1; dx++) { n.world.put(x + dx, y - 1, z, 1, 0, false); n.world.put(x + dx, y, z, 0, 0, false); n.world.put(x + dx, y + 1, z, 0, 0, false); }
  n.world.put(x, y, z, 137, 8 | 1, false); // a powered activator rail
  const cart = s.dimensions.swap(n, () => s.vehicles.spawnVehicle('command_minecart', x + 0.5, y, z + 0.5));
  cart.command.command = `setblock ${x + 1} ${y + 1} ${z} glowstone`;
  for (let i = 0; i < 10 && !cart.command.successCount; i++) ticks(s, social, 1);
  assert.equal(cart.command.successCount, 1);
  assert.equal(n.world.get(x + 1, y + 1, z), GLOWSTONE, 'the block went into the Nether world');
  assert.equal(n.vehicles.cartCommands.length, 0, 'the queue is drained');
});

test('MC|AdvCdm type 1: no reach, an op of level 2 in Creative, native advMode replies', () => {
  const { s, social, sent, a } = fixture();
  s.world.put(100, 10, 100, 137, 8, false);
  const cart = s.vehicles.spawnVehicle('command_minecart', 100.5, 10, 100.5), k = `c${cart.id}`;
  const last = () => sent.filter((x) => x.id === 'a').at(-1)?.m.json ?? '';
  assert.equal(social.setCartCommand('a', k, 'say far'), true, '50 blocks away: nh has no distance check');
  assert.equal(cart.command.command, 'say far');
  assert.match(last(), /advMode\.setCommand\.success/); assert.match(last(), /say far/);
  a.survival.mode = 'survival';
  assert.equal(social.setCartCommand('a', k, 'say z'), false); assert.match(last(), /advMode\.notAllowed/);
  a.survival.mode = 'creative';
  s.admin.ops.set?.('alicex', { level: 1 });
  const low = fixture({ ops: [] }); low.s.world.put(66, 10, 66, 137, 8, false);
  const lc = low.s.vehicles.spawnVehicle('command_minecart', 66.5, 10, 66.5);
  assert.equal(low.social.setCartCommand('a', `c${lc.id}`, 'say y'), false); assert.match(low.sent.at(-1).m.json, /advMode\.notAllowed/);
  const off = fixture({ commandBlocks: false }); off.s.world.put(66, 10, 66, 137, 8, false);
  const oc = off.s.vehicles.spawnVehicle('command_minecart', 66.5, 10, 66.5);
  assert.equal(off.social.setCartCommand('a', `c${oc.id}`, 'say w'), false); assert.match(off.sent.at(-1).m.json, /advMode\.notEnabled/);
  // not a command cart: nothing is set or said
  const plain = s.vehicles.spawnVehicle('minecart', 74.5, 10, 70.5), count = sent.length;
  assert.equal(social.setCartCommand('a', `c${plain.id}`, 'say v'), false);
  assert.equal(social.setCartCommand('a', 'zz', 'say v'), false);
  assert.equal(sent.length, count);
});

test('MC|AdvCdm type 1 looks the cart up in the sender\'s own dimension', { timeout: 120000 }, () => {
  const { s, social, sent, a } = fixture();
  s.world.put(66, 10, 66, 137, 8, false);
  const over = s.vehicles.spawnVehicle('command_minecart', 66.5, 10, 66.5);
  s.dimensions.arrive(a, -1);
  const n = s.dimensions.nether;
  const x = Math.floor(a.position.x) + 2, y = Math.floor(a.position.y), z = Math.floor(a.position.z);
  n.world.put(x, y - 1, z, 1, 0, false); n.world.put(x, y, z, 137, 8, false);
  const nether = s.dimensions.swap(n, () => s.vehicles.spawnVehicle('command_minecart', x + 0.5, y, z + 0.5));
  // ids are shared, so the Overworld cart's key is not in the Nether's list
  const count = sent.length;
  assert.equal(social.setCartCommand('a', `c${over.id}`, 'say over'), over.id === nether.id);
  if (over.id !== nether.id) assert.equal(sent.length, count, 'an entity of another world: nothing said');
  assert.equal(social.setCartCommand('a', `c${nether.id}`, 'say nether'), true);
  assert.equal(nether.command.command, 'say nether');
});

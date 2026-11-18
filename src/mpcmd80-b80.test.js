// Batch 80 mpcmd80: command blocks run on the dedicated server (rising edge, updateTick, success count, commandBlockOutput, level 2), their S35 description, MC|AdvCdm type 0.
// Bytecode-read classes: akb (BlockCommandBlock), aox / aoy (TileEntityCommandBlock), agp (CommandBlockLogic), nh (MC|AdvCdm), mw.a(I,String). Notes: .shared-memory/notes/mpcmd80-b80-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { ServerSocial } from './server-broadcast.js';
import { CommandBlockTiles } from './multiplayer/server-command-blocks.js';
import { COMMAND_BLOCK, COMMAND_BLOCK_ID } from './command-block.js';
import { applyTiles, describeCell, TILE_ACTION } from './tile-sync.js';
import { lastOutputPlainText } from './chat-component.js';
import { toLiveStack } from './mob-equipment-live.js';
import { readFileSync } from 'node:fs';
import { DropRenderer, PLAYER_PICKUP_LIFT, MOB_PICKUP_LIFT } from './drop-renderer.js';

const REDSTONE_BLOCK = 152;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture({ commandBlocks = true, ops = ['alicex'], mode = 'creative' } = {}) {
  const world = new World('mpcmd80-b80');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: mode, mobs: false, commandBlocks });
  const sent = [];
  const social = new ServerSocial({ simulation: s, ops, deliver: (id, m) => sent.push({ id, m }) });
  const a = s.addPlayer('a', 'alicex', key(1)); a.position.copy({ x: 64.5, y: 10, z: 64.5 }); a.previous.copy(a.position);
  s.input('a', { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
  return { s, social, sent, a };
}
// A command block at (60, 10, 60) with `command`; power arrives from a redstone block placed beside it through the engine (World.setBlock notifies the neighbours).
function place(s, command, { redstone = s.redstone, world = s.world, tiles = s.tileEntities.commandBlocks } = {}) {
  world.put(60, 10, 60, COMMAND_BLOCK, 0, false);
  tiles.tile(60, 10, 60).command = command;
  return { power: () => redstone.setBlock(61, 10, 60, REDSTONE_BLOCK, 0, 3), unpower: () => redstone.setBlock(61, 10, 60, 0, 0, 3), tile: tiles.get(60, 10, 60) };
}
const ticks = (s, social, n) => { const out = []; for (let i = 0; i < n; i++) { out.push(s.tick()); social.drain(); } return out; };

test('a rising edge runs the command once on the next tick; continued power does not repeat; the comparator reads the success count', () => {
  const { s, social } = fixture();
  const cb = place(s, 'time set 1000');
  s.time = 5000;
  cb.power();
  assert.equal(s.world.getMeta(60, 10, 60) & 1, 1, 'metadata bit 0 marks the powered state');
  ticks(s, social, 2);
  assert.ok(s.time < 5000, 'the server clock was set by the block');
  assert.equal(cb.tile.successCount, 1);
  assert.equal(s.redstone.behaviours[COMMAND_BLOCK_ID].comparator(s.redstone, 60, 10, 60), 1);
  assert.match(lastOutputPlainText(cb.tile.lastOutput), /^\[\d\d:\d\d:\d\d\] Set the time to 1000/);
  s.time = 5000; ticks(s, social, 4);
  assert.ok(s.time >= 5000, 'no second run while the power stays on');
  cb.unpower(); assert.equal(s.world.getMeta(60, 10, 60) & 1, 0);
  cb.tile.command = 'testfor nobody_here'; cb.power(); ticks(s, social, 2);
  assert.equal(cb.tile.successCount, 0, 'a failed command counts 0');
  assert.equal(s.redstone.behaviours[COMMAND_BLOCK_ID].comparator(s.redstone, 60, 10, 60), 0);
});

test('enable-command-block off: the block does nothing and counts 0', () => {
  const { s, social } = fixture({ commandBlocks: false });
  const cb = place(s, 'time set 1000'); s.time = 5000; cb.tile.successCount = 3;
  cb.power(); ticks(s, social, 3);
  assert.ok(s.time >= 5000);
  assert.equal(cb.tile.successCount, 0);
  assert.equal(cb.tile.lastOutput, null);
});

test('the tracked output resends the S35 description in the same tick; a description carries the agp.a(dh) fields', () => {
  const { s, social } = fixture();
  const cb = place(s, 'time set 1000');
  cb.power();
  const msgs = ticks(s, social, 2), rows = msgs.flatMap((m) => m.tiles ?? []).filter((t) => t.kind === 'command');
  assert.equal(rows.length, 1, JSON.stringify(msgs.map((m) => m.tiles)));
  const r = rows[0];
  assert.equal(r.action, TILE_ACTION.command); assert.equal(r.action, 2);
  assert.deepEqual([r.x, r.y, r.z, r.command, r.successCount, r.customName, r.trackOutput], [60, 10, 60, 'time set 1000', 1, '@', true]);
  assert.equal(r.lastOutput, cb.tile.lastOutput);
  // TrackOutput off: agp.a(fj) stores nothing and does not call e(), so no resend
  // (the port sends every cell change, so the metadata bit written with flag 4 still describes the cell; native sends neither: watch the dirty set instead)
  cb.tile.trackOutput = false; cb.unpower(); cb.power();
  const dirty = [], add = s.dirtyTiles.add.bind(s.dirtyTiles); s.dirtyTiles.add = (k) => { dirty.push(k); return add(k); };
  const before = cb.tile.lastOutput;
  ticks(s, social, 2);
  assert.equal(cb.tile.successCount, 1); assert.equal(cb.tile.lastOutput, before);
  assert.deepEqual(dirty, [], 'no markBlockForUpdate without tracked output');
  // a fresh block with no record is described with the defaults (no LastOutput key)
  s.world.put(62, 10, 60, COMMAND_BLOCK, 0, false);
  const fresh = describeCell(s.tileEntities, 62, 10, 60);
  assert.deepEqual(fresh, { kind: 'command', action: 2, x: 62, y: 10, z: 60, command: '', successCount: 0, customName: '@', trackOutput: true });
});

test('commandBlockOutput: operators see chat.type.admin; the rule off keeps it from them but not from the tile', () => {
  const { s, social, sent } = fixture();
  const cb = place(s, 'time set 1000');
  cb.power(); ticks(s, social, 2);
  const admin = sent.filter((x) => (x.m.json ?? '').includes('chat.type.admin'));
  assert.equal(admin.length, 1, JSON.stringify(sent).slice(0, 400));
  sent.length = 0; s.gameRules.commandBlockOutput = 'false';
  cb.unpower(); cb.tile.command = 'time set 2000'; cb.power(); ticks(s, social, 2);
  assert.equal(sent.filter((x) => (x.m.json ?? '').includes('chat.type.admin')).length, 0);
  assert.match(lastOutputPlainText(cb.tile.lastOutput), /Set the time to 2000/);
});

test('the block sender has level 2: op, deop and the other admin lines do nothing; an unsupported command is refused', () => {
  const { s, social } = fixture({ ops: [] });
  const b = s.addPlayer('b', 'bobx', key(2)); b.position.copy({ x: 66.5, y: 10, z: 64.5 });
  const cb = place(s, 'op bobx');
  cb.power(); ticks(s, social, 2);
  assert.equal(social.isOp('bobx'), false, '/op is not run by a command block');
  assert.equal(cb.tile.successCount, 0);
  cb.unpower(); cb.tile.command = 'publish'; cb.power(); ticks(s, social, 2);
  assert.equal(cb.tile.successCount, 0);
  cb.unpower(); cb.tile.command = 'say hello'; cb.power(); ticks(s, social, 2);
  assert.equal(cb.tile.successCount, 1, 'a level 1 command runs');
});

test('an empty command runs like native executeCommand: the unknown-command line lands in LastOutput', () => {
  const { s, social } = fixture();
  const cb = place(s, '');
  cb.power(); ticks(s, social, 2);
  assert.equal(cb.tile.successCount, 0);
  assert.ok(cb.tile.lastOutput, 'commands.generic.notFound was tracked');
});

test('MC|AdvCdm type 0: a Creative op of level 2 sets the command; the other senders get the native refusal', () => {
  const { s, social, sent, a } = fixture();
  s.world.put(60, 10, 60, COMMAND_BLOCK, 0, false);
  assert.equal(social.setBlockCommand('a', 60, 10, 60, 'say hi'), true);
  assert.equal(s.tileEntities.commandBlocks.get(60, 10, 60).command, 'say hi');
  assert.ok(s.dirtyTiles.has('60,10,60'), 'func_145756_e: the S35 goes out');
  assert.match(sent.at(-1).m.json, /advMode\.setCommand\.success/);
  // not a command block: nothing is set or said
  const n = sent.length;
  assert.equal(social.setBlockCommand('a', 61, 10, 60, 'say no'), false); assert.equal(sent.length, n);
  // Survival
  a.survival.mode = 'survival';
  assert.equal(social.setBlockCommand('a', 60, 10, 60, 'say z'), false); assert.match(sent.at(-1).m.json, /advMode\.notAllowed/);
  a.survival.mode = 'creative';
  // not an operator
  const other = fixture({ ops: [] }); other.s.world.put(60, 10, 60, COMMAND_BLOCK, 0, false);
  assert.equal(other.social.setBlockCommand('a', 60, 10, 60, 'say y'), false); assert.match(other.sent.at(-1).m.json, /advMode\.notAllowed/);
  // command blocks disabled
  const off = fixture({ commandBlocks: false }); off.s.world.put(60, 10, 60, COMMAND_BLOCK, 0, false);
  assert.equal(off.social.setBlockCommand('a', 60, 10, 60, 'say w'), false); assert.match(off.sent.at(-1).m.json, /advMode\.notEnabled/);
  assert.equal(s.tileEntities.commandBlocks.get(60, 10, 60).command, 'say hi');
});

test('breaking the block removes its record; /setblock with a Control tag writes the server record', () => {
  const { s, social } = fixture();
  const cb = place(s, 'say hi'); cb.tile.successCount = 1;
  s.world.put(60, 10, 60, 0, 0, false); ticks(s, social, 1);
  assert.equal(s.tileEntities.commandBlocks.get(60, 10, 60), null);
  s.world.put(60, 10, 60, COMMAND_BLOCK, 0, false); ticks(s, social, 1);
  assert.equal(s.tileEntities.commandBlocks.get(60, 10, 60), null, 'a new block starts empty');
  social.command('a', '/setblock 70 10 70 command_block 0 replace {Command:"time set 777",CustomName:"Clock"}');
  const t = s.tileEntities.commandBlocks.get(70, 10, 70);
  assert.equal(t?.command, 'time set 777'); assert.equal(t.customName, 'Clock');
});

test('the client applies the S35 like agp.b(dh): an absent LastOutput keeps the old one', () => {
  const world = new World('mpcmd80-client'); world.put(5, 10, 5, COMMAND_BLOCK, 0, false);
  const commandBlocks = new CommandBlockTiles();
  const last = '{"text":"[12:00:00] ","extra":[{"text":"hi"}]}';
  assert.equal(applyTiles([{ kind: 'command', action: 2, x: 5, y: 10, z: 5, command: 'say hi', successCount: 1, customName: 'Bob', lastOutput: last, trackOutput: true }], { world, commandBlocks }), 1);
  const t = commandBlocks.get(5, 10, 5);
  assert.deepEqual([t.command, t.successCount, t.customName, t.trackOutput], ['say hi', 1, 'Bob', true]);
  assert.equal(lastOutputPlainText(t.lastOutput), '[12:00:00] hi');
  applyTiles([{ kind: 'command', action: 2, x: 5, y: 10, z: 5, command: 'say ho', successCount: 0, customName: '@', trackOutput: false }], { world, commandBlocks });
  assert.deepEqual([t.command, t.successCount, t.customName, t.trackOutput], ['say ho', 0, '@', false]);
  assert.equal(lastOutputPlainText(t.lastOutput), '[12:00:00] hi', 'kept');
  // not a command block cell, or a broken LastOutput: not applied
  assert.equal(applyTiles([{ kind: 'command', x: 6, y: 10, z: 5, command: 'x', successCount: 0 }], { world, commandBlocks }), 0);
  assert.equal(applyTiles([{ kind: 'command', x: 5, y: 10, z: 5, command: 'x', successCount: 0, lastOutput: '{bad' }], { world, commandBlocks }), 0);
  assert.equal(t.command, 'say ho');
});

test('a Nether command block runs in the Nether with a player there and resends through the Nether message', { timeout: 120000 }, () => {
  const { s, social, a } = fixture();
  s.dimensions.arrive(a, -1);
  const n = s.dimensions.nether, lane = n.n ?? n;
  const x = Math.floor(a.position.x) + 3, y = Math.floor(a.position.y), z = Math.floor(a.position.z);
  for (const [dx, dz] of [[0, 0], [1, 0]]) { lane.world.put(x + dx, y - 1, z + dz, 1, 0, false); lane.world.put(x + dx, y, z + dz, 0, 0, false); }
  lane.world.put(x, y, z, COMMAND_BLOCK, 0, false);
  lane.tileEntities.commandBlocks.tile(x, y, z).command = 'time set 1234';
  s.time = 5000;
  lane.redstone.setBlock(x + 1, y, z, REDSTONE_BLOCK, 0, 3);
  let rows = [];
  for (let i = 0; i < 3; i++) { s.tick(); const m = s.dimensions.alt[-1]; social.drain(); rows.push(...[...(m.tiles ?? []), ...(m.chunks ?? []).flatMap((c) => c.tiles ?? [])].filter((t) => t.kind === 'command')); }
  const t = lane.tileEntities.commandBlocks.get(x, y, z);
  assert.equal(t.successCount, 1);
  assert.ok(s.time < 5000);
  assert.equal(rows.length, 1, 'the S35 rides in the Nether tick message');
  assert.equal(s.tileEntities.commandBlocks.get(x, y, z), null, 'the Overworld store is untouched');
});

// "Diamonds to you!" from a mob pickup (bytecode-read sw.e): a diamond whose EntityItem has a thrower name (xk.j() != null) awards diamondsToYou to
// World.getPlayerEntityByName(thrower) of the MOB's world (ahb.a(String) walks that world's playerEntities); there is no collector or owner check.
// The whole pickup needs canPickUpLoot, a live mob and the mobGriefing gamerule.
function mobFixture() {
  const world = new World('mpcmd80-b80-mobs');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const join = (id, name, n) => { const p = s.addPlayer(id, name, key(n)); s.input(id, { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) }); p.position.copy({ x: 100.5, y: 10, z: 100.5 }); p.previous.copy(p.position); return p; };
  const awards = [], award = s.achievements.award.bind(s.achievements);
  s.achievements.award = (p, id) => { if (id === 'diamondsToYou') awards.push(p.name); return award(p, id); };
  return { s, join, awards };
}
const DIAMOND = toLiveStack({ id: 264, count: 1, damage: 0 }).id;
function zombieTakes(lane, s, thrower, at = { x: 64.5, y: 10, z: 64.5 }) {
  const z = lane.mobs.mobs.create('zombie', at.x, at.y, at.z); lane.mobs.mobs.entities.push(z);
  z.canPickUpLoot = true; z.equipment = [null, null, null, null, null];
  lane.mobs.mobs.entities = lane.mobs.mobs.entities.filter((e) => e === z);
  const item = lane.items.spawn({ id: DIAMOND, count: 1, damage: 0 }, at.x, at.y + 0.3, at.z);
  if (thrower) item.thrower = thrower;
  for (let i = 0; i < 6 && !z.equipment[0]; i++) s.tick();
  return z;
}

test('a server zombie picking up a thrown diamond awards the online thrower; an unnamed or offline thrower gets nothing', () => {
  for (const [thrower, expect] of [['alicex', ['alicex']], ['carolx', []], [null, []]]) {
    const { s, join, awards } = mobFixture();
    join('a', 'alicex', 1); join('b', 'bobx', 2);
    const z = zombieTakes(s, s, thrower);
    assert.equal(z.equipment[0]?.id, 264, `${thrower}: the zombie holds the diamond`);
    assert.deepEqual(awards, expect, `${thrower}: award`);
  }
});

test('the thrower is found in the mob\'s own dimension only (ahb.a(String)); a Nether pickup of an Overworld player\'s diamond awards nothing', { timeout: 120000 }, () => {
  for (const [netherThrower, expect] of [[false, []], [true, ['alicex']]]) {
    const { s, join, awards } = mobFixture();
    const a = join('a', 'alicex', 1), b = join('b', 'bobx', 2);
    const visitor = netherThrower ? a : b;
    s.dimensions.arrive(visitor, -1);
    const z = zombieTakes(s.dimensions.nether, s, 'alicex', { ...visitor.position });
    assert.equal(z.equipment[0]?.id, 264, 'the Nether zombie holds the diamond');
    assert.deepEqual(awards, expect);
  }
});

test('gamerule mobGriefing false reaches the server\'s mobs: no pickup, no award', () => {
  const { s, join, awards } = mobFixture();
  join('a', 'alicex', 1);
  s.gameRules.mobGriefing = 'false';
  const z = zombieTakes(s, s, 'alicex');
  assert.equal(z.equipment[0], null);
  assert.deepEqual(awards, []);
  assert.equal(s.items.items.filter((e) => e.stack?.id === DIAMOND).length, 1, 'the diamond stays on the ground');
});

test('EntityPickupFX end point: a player collector 1.12 above the feet, a mob collector 0.5 below (bjb.a(ij) yOffs -0.5, blb posY + yOffs); main.js passes the mob lift', () => {
  assert.equal(PLAYER_PICKUP_LIFT, 1.62 - 0.5);
  assert.equal(MOB_PICKUP_LIFT, -0.5);
  const drops = Object.create(DropRenderer.prototype), item = { x: 0, y: 0, z: 0 };
  drops.piles = new Map([[item, {}]]); drops.flying = [];
  drops.pickup(item, { x: 1, y: 2, z: 3 }, MOB_PICKUP_LIFT);
  assert.equal(drops.flying[0].lift, -0.5);
  const src = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  assert.match(src, /scene\.drops\.pickup\(e, who, mobWho \? MOB_PICKUP_LIFT : PLAYER_PICKUP_LIFT\)/);
  assert.match(src, /mobs\.itemPickedUp = \(e, item\) => scene\.drops\.pickup\(item, e, MOB_PICKUP_LIFT\)/);
});

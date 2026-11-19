// Batch 82 mpcmd82: command block leftovers. /spawnpoint <other> from a server block uses the target's position (CommandSetSpawnpoint bp.b, bytecode-read: mw.f_ of the target);
// a success count above 15 runs through comparators unclamped and is clamped only where World.getStrongestIndirectPower (ahb.w) clamps (wire), as the bytecode reads (akc.h, akj.h,
// ahb.u / ahb.g / ahb.w); and the optional server residency model (multiplayer/server-residency.js). Notes: .shared-memory/notes/mpcmd82-b82-track.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from './world.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { ServerSocial } from './server-broadcast.js';
import { COMMAND_BLOCK, COMMAND_BLOCK_ID, installCommandBlocks } from './command-block.js';
import { LiveRedstone } from './redstone-live.js';
import { setWorldSpawn } from './multiplayer/server-worldcmds.js';
import { residentColumns, spawnKeeps } from './multiplayer/server-residency.js';
import { ServerRules } from './multiplayer/server-properties.js';
import { pauseUnloadedTicks } from './streaming-ticks.js';

const REDSTONE_BLOCK = 152, COMPARATOR = 149, WIRE = 55, STONE = 1, REPEATER = 93;
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture({ residency = false, rules, players = true } = {}) {
  const world = new World('mpcmd82-b82');
  for (let x = 0; x < 128; x++) for (let z = 0; z < 128; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'creative', mobs: false, commandBlocks: true, residency, ...(rules ? { rules: new ServerRules(rules) } : {}) });
  const social = new ServerSocial({ simulation: s, ops: ['alicex'], deliver: () => {} });
  const join = (id, name, n, x = 64.5, z = 64.5) => { const p = s.addPlayer(id, name, key(n)); p.position.copy({ x, y: 10, z }); p.previous.copy(p.position); s.input(id, { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) }); return p; };
  if (players) join('a', 'alicex', 1);
  return { s, social, join };
}
const ticks = (s, social, n) => { for (let i = 0; i < n; i++) { s.tick(); social.drain(); } };
function place(s, command, x = 60, z = 60) {
  s.world.put(x, 10, z, COMMAND_BLOCK, 0, false);
  s.tileEntities.commandBlocks.tile(x, 10, z).command = command;
  return { power: () => s.redstone.setBlock(x + 1, 10, z, REDSTONE_BLOCK, 0, 3), unpower: () => s.redstone.setBlock(x + 1, 10, z, 0, 0, 3), tile: s.tileEntities.commandBlocks.get(x, 10, z) };
}

test('/spawnpoint <other player> from a server command block uses that player\'s own position, not the base player\'s', () => {
  const { s, social, join } = fixture();
  const b = join('b', 'bobx', 2, 90.5, 80.5);
  const cb = place(s, 'spawnpoint bobx'); // alicex (64.5, 64.5) is the nearest player: the redirect base
  cb.power(); ticks(s, social, 2);
  assert.equal(cb.tile.successCount, 1);
  assert.deepEqual(b.spawnpoint, [90, 10, 80], 'bp.b: the target\'s mw.f_ (floor x, floor(y + 0.5), floor z); b81 gave [64, 10, 64], the base player\'s block');
  assert.ok(!s.players.get('a').spawnpoint, 'the base player is untouched');
  cb.unpower(); cb.tile.command = 'spawnpoint alicex'; cb.power(); ticks(s, social, 2);
  assert.deepEqual(s.players.get('a').spawnpoint, [64, 10, 64], 'the base player itself (no redirect)');
  cb.unpower(); cb.tile.command = 'spawnpoint @a'; cb.power(); ticks(s, social, 2);
  assert.equal(cb.tile.successCount, 2);
  b.position.copy({ x: 100.5, y: 10, z: 30.5 });
  cb.unpower(); cb.tile.command = 'spawnpoint bobx'; cb.power(); ticks(s, social, 2);
  assert.deepEqual(b.spawnpoint, [100, 10, 30], 'follows the target after it moved');
  cb.unpower(); cb.tile.command = 'spawnpoint'; cb.power(); ticks(s, social, 2);
  assert.equal(cb.tile.successCount, 0, 'no argument: getCommandSenderAsPlayer on a block throws');
});

// A line along +x: the command block at x0, then the given cells (original ids), facing +x (direction 1: input at x - 1).
function line(redstone, x0, cells, { side } = {}) {
  cells.forEach(([id, meta = 0], i) => redstone.setBlock(x0 + 1 + i, 10, 4, id, meta, 3));
  if (side) { redstone.setBlock(side[0], 10, side[1], WIRE, 0, 3); redstone.setBlock(side[0], 10, side[1] + 1, REDSTONE_BLOCK, 0, 3); } // akj.i reads a side wire's metadata (a redstone block's strong power is 0)
}
function engine() {
  const world = new World('mpcmd82-sp');
  for (let x = 0; x < 32; x++) for (let z = 0; z < 16; z++) world.put(x, 9, z, 1, 0, false);
  const redstone = new LiveRedstone(world);
  const cbs = installCommandBlocks(redstone, { host: () => ({ name: 'Player', print() {}, feedback() {}, cheats: true, players: () => [], position: () => ({ x: 0, y: 10, z: 0 }) }) });
  return { world, redstone, cbs };
}
const settle = (redstone) => { for (let i = 0; i < 12; i++) redstone.tick(); };
const signal = (redstone, x) => redstone.comparatorTile(x, 10, 4).signal;

test('a count above 15 passes through comparators unclamped and is clamped only by the wire (akc.h / akj.h / ahb.u, ahb.g unclamped; ahb.w returns 15)', () => {
  for (const [name, x0] of [['comparator to comparator to wire', 2]]) {
    const { world, redstone, cbs } = engine();
    world.put(x0, 10, 4, COMMAND_BLOCK, 0, false);
    cbs.tile(x0, 10, 4).successCount = 20;
    line(redstone, x0, [[COMPARATOR, 1], [COMPARATOR, 1], [WIRE]]);
    redstone.updateNeighbourForOutputSignal(x0, 10, 4, COMMAND_BLOCK_ID);
    settle(redstone);
    assert.equal(signal(redstone, x0 + 1), 20, name + ': akc.h returns akb.g (agp.g), the count, and aoz keeps it');
    assert.equal(signal(redstone, x0 + 2), 20, name + ': akj.h: an input of 15 or more is returned as is');
    assert.equal(redstone.getBlockMetadata(x0 + 3, 10, 4), 15, name + ': the wire takes ahb.w, which returns 15 for 15 or more');
  }
  { // subtract mode: max(20 - 15, 0) = 5 (a clamped 15 would give 0)
    const { world, redstone, cbs } = engine();
    world.put(2, 10, 4, COMMAND_BLOCK, 0, false);
    cbs.tile(2, 10, 4).successCount = 20;
    line(redstone, 2, [[COMPARATOR, 1], [COMPARATOR, 1 | 4]], { side: [4, 5] });
    redstone.updateNeighbourForOutputSignal(2, 10, 4, COMMAND_BLOCK_ID);
    settle(redstone);
    assert.equal(signal(redstone, 4), 5, 'akc.j: Math.max(h(rear) - h(sides), 0) with rear 20 and a full wire (15) at the side');
  }
  { // through a solid block: ahb.g -> ahb.u returns the comparator's strong power (20) unclamped; a repeater after it gives 15
    const { world, redstone, cbs } = engine();
    world.put(2, 10, 4, COMMAND_BLOCK, 0, false);
    cbs.tile(2, 10, 4).successCount = 20;
    line(redstone, 2, [[COMPARATOR, 1], [STONE], [COMPARATOR, 1], [REPEATER, 1], [COMPARATOR, 1]]);
    redstone.updateNeighbourForOutputSignal(2, 10, 4, COMMAND_BLOCK_ID);
    settle(redstone);
    assert.equal(signal(redstone, 5), 20, 'comparator behind a block powered by a 20 comparator reads 20');
    assert.equal(signal(redstone, 7), 15, 'a repeater outputs 15');
  }
});

test('the server comparator reads a count above 15 unclamped (server-command-blocks.js on the shared engine)', () => {
  const { s, social } = fixture();
  const cb = place(s, 'say hi', 40, 40);
  cb.tile.successCount = 20;
  s.redstone.setBlock(41, 10, 40, COMPARATOR, 1, 3);
  s.redstone.setBlock(42, 10, 40, COMPARATOR, 1, 3);
  s.redstone.setBlock(43, 10, 40, WIRE, 0, 3);
  s.redstone.updateNeighbourForOutputSignal(40, 10, 40, COMMAND_BLOCK_ID);
  ticks(s, social, 12);
  assert.equal(s.redstone.comparatorTile(41, 10, 40).signal, 20);
  assert.equal(s.redstone.comparatorTile(42, 10, 40).signal, 20);
  assert.equal(s.redstone.getBlockMetadata(43, 10, 40), 15);
});

test('residency: with the spawn inside the 128 window every column is a native spawn chunk (nothing would unload)', () => {
  const { s } = fixture({ residency: true, players: false });
  assert.equal(residentColumns(s).size, 64, 'every chunk centre (8..120) is within 128 of a spawn inside the window');
  for (let sx = 0; sx < 128; sx += 9) for (let c = 0; c < 8; c++) assert.ok(spawnKeeps([sx, 64, 64], c, 3));
  assert.equal(spawnKeeps([-9, 64, 64], 7, 3), false, 'centre 120 is 129 from x = -9: unloadChunksIfNotNearSpawn queues it');
  assert.equal(spawnKeeps([-8, 64, 64], 7, 3), true, '128 is kept (the test is > 128)');
  setWorldSpawn(s, [-9, 10, 64]);
  const set = residentColumns(s);
  assert.equal(set.has('7,3'), false);
  assert.equal(set.has('6,3'), true);
  assert.equal(set.size, 56);
});

test('residency: a far block runs only while a player watches its column; without the flag it always runs', () => {
  for (const residency of [false, true]) {
    const { s, social, join } = fixture({ residency, players: false, rules: { viewDistance: 3 } });
    setWorldSpawn(s, [-300, 10, -300]); // every window chunk is more than 128 from the spawn
    const cb = place(s, 'setblock 100 12 100 stone', 100, 100);
    cb.power(); ticks(s, social, 3);
    assert.equal(s.world.get(100, 12, 100) !== 0, !residency, residency ? 'no watcher and not a spawn chunk: the tick waits' : 'flag off: the Overworld always ticks');
    if (!residency) continue;
    join('a', 'alicex', 1, 8.5, 8.5); ticks(s, social, 2); // chunk 0,0 with radius 3 reaches chunk 3; the block is in chunk 6
    assert.equal(s.world.get(100, 12, 100), 0, 'a player in chunk (0, 0) with view distance 3 does not watch chunk (6, 6)');
    assert.equal(cb.tile.successCount, 0);
    s.players.get('a').position.copy({ x: 90.5, y: 10, z: 90.5 }); ticks(s, social, 3);
    assert.notEqual(s.world.get(100, 12, 100), 0, 'once the player\'s managed chunk is within 3 the pending tick runs');
    assert.equal(cb.tile.successCount, 1);
  }
});

test('residency: fluid and fire entries of a non-resident column keep their delay (pauseUnloadedTicks on a finite world)', () => {
  const entries = [{ x: 5, z: 5, time: 10, id: 1 }, { x: 200, z: 5, time: 10, id: 2 }];
  pauseUnloadedTicks({ streaming: false }, entries, () => true);
  assert.deepEqual(entries.map(e => e.time), [10, 10], 'no residency: unchanged');
  pauseUnloadedTicks({ streaming: false, tickResident: (x) => x < 128 }, entries, () => true);
  assert.deepEqual(entries.map(e => [e.id, e.time]), [[1, 10], [2, 11]]);
});

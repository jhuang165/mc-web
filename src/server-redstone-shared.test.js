// The browser runtime's redstone behaviours on the gun server (redstone-runtime.js installSharedBehaviours and redstoneEntitiesIn,
// wired in multiplayer/simulation.js): plates that sense mobs, note blocks and jukeboxes (with the record for the players near and the
// disc taken and ejected), the trapped chest's viewer power, detector rails under a cart and a fence gate opened by power. Before this
// the server's plates sensed only players and none of these blocks had their behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { STONE_PRESSURE_PLATE, REDSTONE_BLOCK, REDSTONE_LAMP, REDSTONE_LAMP_LIT } from './world.js';
import { NOTE_BLOCK, JUKEBOX, DISC_FIRST } from './note-jukebox-content.js';
import { TRAPPED_CHEST } from './chest-blocks.js';
import { FENCE_GATE, gateOpen } from './shaped-blocks.js';
import { DETECTOR_RAIL } from './rails.js';
import { newChest } from './chest.js';
import { makeStack } from './inventory.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const STONE = 3;
const run = (sim, n) => { for (let i = 0; i < n; i++) sim.tick(); };

// Alice (and Bob, 3 blocks away) in Survival on a stone floor in the sky; Alice looks straight down at (x, y - 1, z).
function arena() {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, { config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 }, random: seeded(5) });
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a'), b = sim.addPlayer('b', 'Bob', 'acct-b');
  const x = Math.floor(a.position.x), z = Math.floor(a.position.z), y = 150;
  for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) sim.world.put(x + dx, y - 1, z + dz, STONE, 0);
  for (const p of [a, b]) { p.survival.mode = 'survival'; p.survival.inventory.creative = false; p.survival.inventory.main.fill(null); p.yaw = 0; p.pitch = -Math.PI / 2 + 0.01; }
  sim.teleport(a, { x: x + 0.5, y, z: z + 0.5 });
  sim.teleport(b, { x: x + 3.5, y, z: z + 0.5 });
  run(sim, 3);
  for (const p of [a, b]) sim.drainEvents(p);
  return { sim, a, b, x, y, z };
}

test('a stone pressure plate senses a pig, not only players', () => {
  const { sim, x, y, z } = arena();
  sim.world.set(x + 6, y, z, STONE_PRESSURE_PLATE, true, 0);
  run(sim, 2);
  assert.equal(sim.world.getMeta(x + 6, y, z), 0);
  const pig = sim.mobs.ew.create('pig', x + 6.5, y, z + 0.5);
  sim.mobs.ew.entities.push(pig);
  for (let i = 0; i < 6; i++) { pig.x = x + 6.5; pig.z = z + 0.5; pig.vx = pig.vz = 0; sim.tick(); }
  assert.equal(sim.world.getMeta(x + 6, y, z), 1, 'BlockPressurePlate: mobs');
});

test('a note block tunes on use and plays on a punch, heard and seen by the players near', () => {
  const { sim, a, b, x, y, z } = arena();
  sim.world.set(x, y - 1, z, NOTE_BLOCK, true, 0);
  run(sim, 1);
  for (const p of [a, b]) sim.drainEvents(p);
  assert.equal(sim.edit(a, true), true);
  run(sim, 2);
  assert.equal(sim.music.noteBlocks.save().find(e => e.x === x && e.y === y - 1 && e.z === z)?.note, 1, 'TileEntityNote.changePitch');
  for (const p of [a, b]) {
    const list = sim.drainEvents(p);
    assert.ok(list.some(e => e.type === 'sound' && e.sound.startsWith('note.')), `${p.name} hears the note`);
    assert.ok(list.some(e => e.type === 'fx' && e.kind === 'particle' && e.name === 'note'), `${p.name} sees the note particle`);
  }
  sim.mine(a, true); sim.tick(); sim.mine(a, false); run(sim, 2);
  assert.ok(sim.drainEvents(b).some(e => e.type === 'sound' && e.sound.startsWith('note.')), 'BlockNote.onBlockClicked plays it');
  assert.equal(sim.world.get(x, y - 1, z), NOTE_BLOCK, 'one punch does not break it');
  assert.ok(sim.save().music.some(e => e.kind === 'note' && e.note === 1), 'the note is saved');
});

test('a jukebox takes the held disc, sends its record to the players near, and ejects it on the next use', () => {
  const { sim, a, b, x, y, z } = arena();
  sim.world.set(x, y - 1, z, JUKEBOX, true, 0);
  const inv = a.survival.inventory;
  inv.main[0] = makeStack(DISC_FIRST + 1, 1, 0); inv.current = 0;
  run(sim, 1);
  for (const p of [a, b]) sim.drainEvents(p);
  assert.equal(sim.edit(a, true), true);
  run(sim, 1);
  assert.equal(inv.main[0], null, 'the disc leaves the stack in Survival');
  assert.equal(sim.world.getMeta(x, y - 1, z), 1, 'BlockJukebox: has a record');
  for (const p of [a, b]) assert.deepEqual(sim.drainEvents(p).filter(e => e.type === 'record').map(e => [e.item, e.x, e.y, e.z]), [[DISC_FIRST + 1, x, y - 1, z]], p.name);
  assert.equal(sim.edit(a, true), true);
  run(sim, 2);
  assert.equal(sim.world.getMeta(x, y - 1, z), 0, 'the record is out');
  assert.ok(sim.drainEvents(b).some(e => e.type === 'record' && e.item === null), 'the record stops');
  assert.ok(sim.play.items.items.some(e => e.stack?.id === DISC_FIRST + 1 || e.item?.id === DISC_FIRST + 1 || e.id === DISC_FIRST + 1), 'the disc is ejected');
});

test('a trapped chest powers a lamp beside it while a player has it open', () => {
  const { sim, a, x, y, z } = arena();
  const cx = x + 2, cz = z;
  sim.world.set(cx, y, cz, TRAPPED_CHEST, true, 0);
  sim.tiles.chests[`${cx},${y},${cz}`] = newChest();
  sim.world.set(cx + 1, y, cz, REDSTONE_LAMP, true, 0);
  run(sim, 2);
  const lit = () => sim.world.get(cx + 1, y, cz) === REDSTONE_LAMP_LIT;
  assert.equal(lit(), false);
  const chest = a.survival.openChest(sim.world, cx, y, cz);
  assert.ok(chest, 'the chest opens');
  sim.play.open(a, 'chest', chest, { key: `${cx},${y},${cz}`, at: [cx, y, cz] });
  run(sim, 2);
  assert.equal(lit(), true, 'TileEntityChest.numPlayersUsing powers it');
  sim.play.closeWindow(a);
  run(sim, 8);
  assert.equal(lit(), false, 'closed: no viewers, no power');
});

test('a detector rail is powered while a minecart is on it', () => {
  const { sim, x, y, z } = arena();
  const rx = x + 5, rz = z + 4;
  sim.world.set(rx, y, rz, DETECTOR_RAIL, true, 0);
  run(sim, 2);
  assert.equal(sim.world.getMeta(rx, y, rz) & 8, 0);
  sim.mobs.minecarts.spawnEmpty({ x: rx + 0.5, y: y + 0.0625, z: rz + 0.5 });
  run(sim, 6);
  assert.equal(sim.world.getMeta(rx, y, rz) & 8, 8, 'BlockRailDetector.onEntityCollidedWithBlock');
});

test('a fence gate opens when powered and closes again', () => {
  const { sim, x, y, z } = arena();
  const gx = x - 4, gz = z + 3;
  sim.world.set(gx, y, gz, FENCE_GATE, true, 0);
  run(sim, 2);
  assert.equal(gateOpen(sim.world.getMeta(gx, y, gz)), false);
  sim.world.set(gx + 1, y, gz, REDSTONE_BLOCK, true, 0);
  run(sim, 2);
  assert.equal(gateOpen(sim.world.getMeta(gx, y, gz)), true, 'BlockFenceGate.onNeighborBlockChange');
  sim.world.set(gx + 1, y, gz, 0, true, 0);
  run(sim, 2);
  assert.equal(gateOpen(sim.world.getMeta(gx, y, gz)), false);
});

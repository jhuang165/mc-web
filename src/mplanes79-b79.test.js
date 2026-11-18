// Batch 79 mplanes79: server leftovers (mob pickup collect animation in every lane, command block tile store, eye aux by dimension, piston-moving click).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World, PISTON_MOVING } from './world.js';
import { fromOriginal } from './block-registry.js';
import { NBT } from './nbt.js';
import { nbtToJson } from './spawner-data.js';
import { toLiveStack } from './mob-equipment-live.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { serverFallingTile } from './multiplayer/server-falling-tiles.js';
import { CommandBlockTiles } from './multiplayer/server-command-blocks.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { ITEM_EYE_OF_ENDER } from './eye-of-ender.js';

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const tag = (type, value) => ({ type, value });
const compound = (o) => tag(NBT.COMPOUND, new Map(Object.entries(o)));
function fixture(mobs = false) {
  const world = new World('mplanes79-b79');
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: 'survival', mobs });
  if (mobs) { s.mobs.spawning = false; s.mobs.mobs.entities.length = 0; }
  return s;
}
const join = (s, id, n) => { const p = s.addPlayer(id, id, key(n)); s.input(id, { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) }); return p; };
const sword = () => toLiveStack({ id: 267, count: 1, damage: 0 }).id;

test('an Overworld mob pickup sends S0D with the mob as collector', () => {
  const s = fixture(true), p = join(s, 'a', 1); p.position.copy({ x: 100.5, y: 10, z: 100.5 });
  const z = s.mobs.mobs.create('zombie', 64.5, 10, 64.5); s.mobs.mobs.entities.push(z);
  z.canPickUpLoot = true; z.equipment = [null, null, null, null, null];
  const rows = [], taken = s.serverItems.taken, push = taken.push.bind(taken); taken.push = (...r) => { rows.push(...r); return push(...r); };
  const item = s.items.spawn({ id: sword(), count: 1, damage: 0 }, 64.5, 10.3, 64.5);
  for (let i = 0; i < 4 && !rows.length; i++) s.tick();
  assert.equal(z.equipment[0]?.id, 267);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].i, item.eid);
  assert.equal(rows[0].by, null);
  assert.equal(rows[0].mob, Number(String(z.id).replace(/^mob-/, '')));
  assert.ok(Math.abs(rows[0].at.x - z.x) < 1 && Math.abs(rows[0].at.y - z.y) < 1);
});

test('Nether and End mob pickups work and report to that lane\'s own list', { timeout: 120000 }, () => {
  for (const dim of [-1, 1]) {
    const s = fixture(true), a = join(s, 'a', 1);
    s.dimensions.arrive(a, dim);
    const n = dim === 1 ? s.dimensions.end.n : s.dimensions.nether;
    const lane = n.n ?? n;
    const z = lane.mobs.mobs.create('zombie', a.position.x, a.position.y, a.position.z); lane.mobs.mobs.entities.push(z);
    z.canPickUpLoot = true; z.equipment = [null, null, null, null, null];
    lane.mobs.mobs.entities = lane.mobs.mobs.entities.filter((e) => e === z);
    const rows = [], push = lane.taken.push.bind(lane.taken); lane.taken.push = (...r) => { rows.push(...r); return push(...r); };
    const before = s.serverItems.taken.length;
    const item = lane.items.spawn({ id: sword(), count: 1, damage: 0 }, a.position.x, a.position.y + 0.3, a.position.z);
    for (let i = 0; i < 6 && !rows.length; i++) s.tick();
    assert.equal(z.equipment[0]?.id, 267, `dimension ${dim} zombie picked the sword up`);
    assert.equal(rows.filter((r) => r.i === item.eid && r.mob != null).length, 1, `dimension ${dim} S0D row`);
    assert.equal(s.serverItems.taken.length, before, 'the Overworld list is untouched');
  }
});

test('the client flies a mob-collected item to the row\'s place (source check)', () => {
  const src = readFileSync(new URL('./main.js', import.meta.url), 'utf8');
  assert.match(src, /who = mobWho \?\? t\.at \?\? \(t\.by === multiplayer\.id/); // b80 mpcmd80: the live mob copy comes first, `at` stays the fallback
});

test('a falling command block\'s TileEntityData lands in the server\'s command block store and is saved', () => {
  const s = fixture();
  assert.ok(s.tileEntities.commandBlocks instanceof CommandBlockTiles);
  const b = fromOriginal(137, 0), w = s.world;
  w.put(5, 20, 5, b.id, b.meta, false);
  serverFallingTile(s)(5, 20, 5, b.id, nbtToJson(compound({ Command: tag(NBT.STRING, 'say hi'), CustomName: tag(NBT.STRING, 'Bob'), SuccessCount: tag(NBT.INT, 3) })), 0);
  const t = s.tileEntities.commandBlocks.get(5, 20, 5);
  assert.equal(t.command, 'say hi'); assert.equal(t.customName, 'Bob'); assert.equal(t.successCount, 3);
  assert.ok(s.dirtyTiles.has('5,20,5'));
  const saved = JSON.parse(JSON.stringify(s.save()));
  assert.equal(saved.tileEntities.commandBlocks.length, 1);
  const again = new DedicatedSimulation(saved, { world: fixture().world, gameMode: 'survival', mobs: false });
  assert.equal(again.tileEntities.commandBlocks.get(5, 20, 5)?.command, 'say hi');
  // a cell that no longer holds a command block is not saved
  w.put(5, 20, 5, 0, 0, false);
  assert.equal(s.tileEntities.commandBlocks.toJSON(w).length, 0);
  assert.equal(CommandBlockTiles.fromJSON(null).tiles.size, 0);
});

test('the Nether keeps its own command block store', { timeout: 120000 }, () => {
  const s = fixture(), a = join(s, 'a', 1);
  s.dimensions.arrive(a, -1);
  const n = s.dimensions.nether;
  assert.ok((n.n ?? n).tileEntities.commandBlocks instanceof CommandBlockTiles);
  assert.notEqual((n.n ?? n).tileEntities.commandBlocks, s.tileEntities.commandBlocks);
});

test('eye of ender fx rows carry the thrower dimension (source check; a Nether or End throw finds no stronghold, recalled)', { timeout: 120000 }, () => {
  const s = fixture(), a = join(s, 'a', 1);
  a.survival.inventory.main[0] = { id: ITEM_EYE_OF_ENDER, count: 2, damage: 0 }; a.survival.selected = 0;
  a.itemsOut = [];
  s.dispense.throwHeld(a);
  const aux = (p) => p.itemsOut.filter((m) => m.type === 'aux').flatMap((m) => m.events).filter((e) => e.id === 1002);
  assert.ok(aux(a).length <= 1);
  const src = readFileSync(new URL('./multiplayer/server-eyes.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /dim: 0 \}/, 'no constant dimension 0 left in the fx rows');
  assert.match(src, /nearPlayers\(sim, dim,/);
});

test('a click on a piston-moving block with no tile removes it on the server and refuses the item use', () => {
  const s = fixture(), p = join(s, 'a', 1);
  p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position);
  const put = () => s.world.put(64, 11, 62, PISTON_MOVING, 0, false);
  put();
  assert.equal(s.edit(p, true), true);
  assert.equal(s.world.get(64, 11, 62), 0, 'the orphan moving block is gone');
  // sneaking with an item: onBlockActivated is skipped, the block stays
  put(); p.input.sneak = true; p.survival.inventory.main[0] = { id: 4, count: 3, damage: 0 }; p.survival.selected = 0;
  s.edit(p, true);
  assert.equal(s.world.get(64, 11, 62), PISTON_MOVING, 'sneak with an item leaves it');
});

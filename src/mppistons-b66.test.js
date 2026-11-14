// Batch 66 mppistons: pistons on the dedicated server (server-pistons.js, client-pistons.js).
// Block rules are the shared engine's (redstone.js, replayed by piston*.test.js); this file pins the server and wire half.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, REDSTONE_BLOCK } from './world.js';
import { fromOriginal } from './block-registry.js';
import { PISTON, STICKY_PISTON, PISTON_HEAD } from './dispenser-piston.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { ClientPistons } from './multiplayer/client-pistons.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';

const OBSIDIAN = fromOriginal(49, 0).id;
const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture() {
  const world = new World('b66-pistons');
  for (let x = 40; x <= 100; x++) for (let z = 50; z <= 80; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
}
const join = (s, id, name, n, at) => { const p = s.addPlayer(id, name, key(n)); p.position.copy(at); p.previous.copy(p.position); s.input(id, { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) }); return p; };
// An east facing piston at (60,10,64) powered by a redstone block beside it (not in front).
const powered = (s, kind = PISTON) => { s.world.put(60, 10, 64, kind, 5, false); s.world.put(60, 10, 63, REDSTONE_BLOCK, 0, false); s.redstone.placed?.(60, 10, 63); s.redstone.notifyBlocksOfNeighborChange?.(60, 10, 63, 0); };
const run = (s, n, each) => { for (let i = 0; i < n; i++) { s.tick(); each?.(i); } };

test('a powered piston extends on the server, tells a near player (S24 + moving head) and plays tile.piston.out', () => {
  const s = fixture(), p = join(s, 'a', 'Alice', 1, { x: 64.5, y: 10, z: 70.5 });
  powered(s);
  const msgs = [];
  run(s, 6, () => { msgs.push(...(p.pistonOut ?? [])); p.pistonOut = null; });
  assert.equal(s.world.get(61, 10, 64), PISTON_HEAD, 'the head stands in front');
  assert.equal(s.world.getMeta(60, 10, 64) & 8, 8, 'extended bit');
  const events = msgs.flatMap(m => m.events), tiles = msgs.flatMap(m => m.tiles);
  assert.deepEqual(events.map(e => e.slice(0, 6)), [[60, 10, 64, 33, 0, 5]], 'one S24 event 0 with facing 5');
  assert.equal(tiles.length, 1);
  assert.deepEqual(tiles[0].slice(0, 8), [61, 10, 64, 34, 5, 5, 1, 0], 'the moving head: PISTON_HEAD (34), facing 5, extending');
});

test('the sound goes to the S29 queue of players within 16 blocks only', () => {
  const s = fixture(), near = join(s, 'a', 'Alice', 1, { x: 64.5, y: 10, z: 66.5 }), far = join(s, 'b', 'Bob', 2, { x: 95.5, y: 10, z: 75.5 });
  powered(s);
  run(s, 4);
  assert.ok(near.soundsOut?.some(x => x.name === 'tile.piston.out' && x.volume === 0.5), 'near hears it');
  assert.ok(!far.soundsOut?.some(x => x.name?.startsWith('tile.piston')), 'far does not');
});

test('S24 and the moving block are sent only within 64 blocks', () => {
  const s = fixture(), near = join(s, 'a', 'Alice', 1, { x: 64.5, y: 10, z: 66.5 }), far = join(s, 'b', 'Bob', 2, { x: 125.5, y: 10, z: 64.5 });
  s.world.put(125, 9, 64, 3, 0, false);
  powered(s);
  let n = 0, f = 0;
  run(s, 4, () => { n += (near.pistonOut ?? []).length; f += (far.pistonOut ?? []).length; near.pistonOut = far.pistonOut = null; });
  assert.ok(n > 0); assert.equal(f, 0);
});

test('a piston pushes a server player standing in the head cell, and the position is the server position the client gets', () => {
  const s = fixture(), p = join(s, 'a', 'Alice', 1, { x: 61.5, y: 10, z: 64.5 });
  powered(s);
  run(s, 5);
  assert.ok(p.position.x > 61.9, `pushed east, x=${p.position.x}`);
  assert.equal(s.presence().find(q => q.id === 'a').x, p.position.x);
});

test('a retracting sticky piston pulls the block and sends a moving block that is not extending', () => {
  const s = fixture(), p = join(s, 'a', 'Alice', 1, { x: 64.5, y: 10, z: 70.5 });
  s.world.put(60, 10, 64, STICKY_PISTON, 5, false); s.world.put(60, 10, 63, REDSTONE_BLOCK, 0, false);
  s.redstone.notifyBlocksOfNeighborChange?.(60, 10, 63, 0);
  run(s, 6);
  assert.equal(s.world.get(61, 10, 64), PISTON_HEAD);
  p.pistonOut = null;
  s.world.put(61, 10, 64, PISTON_HEAD, 13, false); // sticky head (meta facing | 8)
  s.world.put(62, 10, 64, 1, 0, false); // stone in front of the head
  s.world.put(60, 10, 63, 0, 0, false); s.redstone.notifyBlocksOfNeighborChange?.(60, 10, 63, REDSTONE_BLOCK);
  const msgs = []; run(s, 6, () => { msgs.push(...(p.pistonOut ?? [])); p.pistonOut = null; });
  assert.equal(msgs.flatMap(m => m.events).some(e => e[4] === 1), true, 'retract event');
  assert.equal(s.world.get(61, 10, 64), 1, 'stone pulled one cell back');
  assert.equal(s.world.get(62, 10, 64), 0);
});

test('13 blocks do not move (push limit 12) and obsidian is immovable', () => {
  const s = fixture(), p = join(s, 'a', 'Alice', 1, { x: 64.5, y: 10, z: 70.5 });
  for (let i = 1; i <= 13; i++) s.world.put(60 + i, 10, 64, 1, 0, false);
  powered(s);
  run(s, 6);
  assert.equal(s.world.get(61, 10, 64), 1, 'not extended');
  assert.equal(s.world.getMeta(60, 10, 64) & 8, 0);
  s.world.put(73, 10, 64, 0, 0, false);
  s.world.put(61, 10, 64, OBSIDIAN, 0, false); // obsidian first in line
  s.redstone.notifyBlocksOfNeighborChange?.(60, 10, 63, REDSTONE_BLOCK);
  run(s, 6);
  assert.equal(s.world.get(61, 10, 64), OBSIDIAN);
});

test('the client steps a moving block like TileEntityPiston (0.5 per tick) and drops it a tick after progress 1', () => {
  const shown = [], c = new ClientPistons({ scene: { setMovingBlocks: l => shown.push(l) } });
  c.apply({ events: [[60, 10, 64, 33, 0, 5]], tiles: [[61, 10, 64, 34, 5, 5, 1, 0, 0.5, 0]] });
  assert.equal(c.tiles.size, 1);
  assert.equal(c.frame(0).length, 1);
  c.tick([]); assert.equal(c.tiles.get('61,10,64').progress, 1);
  assert.equal(c.frame(1).length, 0, 'progress 1 draws nothing');
  c.tick([]); assert.equal(c.tiles.size, 0);
  c.apply({ tiles: [[61, 10, 64, 34, 5, 5, 1, 0, 0.5, 0]] });
  c.tick([[61, 10, 64, PISTON_HEAD, 5]]); assert.equal(c.tiles.size, 0, 'the cell became the head: the tile ends');
  assert.equal(c.events.length, 1);
  assert.ok(shown.length >= 2);
});

test('the Nether builds its own piston system and pushes only its own players', () => {
  const s = fixture(), p = join(s, 'a', 'Alice', 1, { x: 64.5, y: 10, z: 70.5 });
  assert.equal(s.dimensions.arrive(p, -1), true);
  const n = s.dimensions.nether;
  assert.ok(n.pistons && n.pistons !== s.pistons, 'a ServerPistons for the Nether world');
  assert.equal(n.pistons.ctx.dim, -1);
  const at = [Math.floor(p.position.x), Math.floor(p.position.y), Math.floor(p.position.z)];
  n.pistons.events.push([...at, 33, 0, 5]);
  n.pistons.flush();
  assert.ok(p.pistonOut?.some(m => m.events.length === 1), 'a Nether player gets the Nether event');
  const o = join(s, 'b', 'Bob', 2, { x: at[0], y: at[1], z: at[2] });
  n.pistons.events.push([...at, 33, 0, 5]); n.pistons.flush();
  assert.ok(!o.pistonOut, 'an Overworld player does not');
});

// Batch 67 pistons4: server piston follow-ups (collision with moving blocks, landing damage, carts and boats, tiles for late clients).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, REDSTONE_BLOCK } from './world.js';
import { fromOriginal } from './block-registry.js';
import { PISTON, PISTON_HEAD } from './dispenser-piston.js';
import { DedicatedSimulation } from './multiplayer/simulation.js';
import { IDLE_INPUT } from './multiplayer/protocol.js';
import { moveEntity } from './entities.js';
import { movingBoxes } from './moving-boxes.js';

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
function fixture() {
  const world = new World('b67-pistons4');
  for (let x = 40; x <= 140; x++) for (let z = 50; z <= 80; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode: 'survival', mobs: false });
}
const join = (s, id, name, n, at) => { const p = s.addPlayer(id, name, key(n)); p.position.copy(at); p.previous.copy(p.position); s.input(id, { type: 'input', controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) }); return p; };
const powered = s => { s.world.put(60, 10, 64, PISTON, 5, false); s.world.put(60, 10, 63, REDSTONE_BLOCK, 0, false); s.redstone.notifyBlocksOfNeighborChange?.(60, 10, 63, 0); };
const tilesNow = s => s.redstone.pistonTiles();

test('a moving piston block has collision boxes in the server world, and only in its own world', () => {
  const s = fixture(); powered(s);
  let box = null;
  for (let i = 0; i < 6 && !box; i++) { s.tick(); if (tilesNow(s).length) box = [60.5, 10, 63.5, 62.5, 11, 64.5]; }
  assert.ok(box, 'a moving tile exists');
  assert.ok(movingBoxes(box, s.world).length > 0, 'the moving head collides');
  assert.deepEqual(movingBoxes(box, new World('other')), [], 'another world sees nothing');
});

test('entities.moveEntity on the server world is blocked by the moving block', () => {
  const s = fixture(); powered(s);
  for (let i = 0; i < 6 && !(tilesNow(s)[0]?.lastProgress >= 0.5); i++) s.tick(); // collision uses lastProgress (partial 0): the head box leaves the base cell on the second tick
  const t = tilesNow(s)[0], mover = (world) => { const b = { x: t.x + 1.9, y: 10, z: t.z + 0.5, vx: 0, vy: 0, vz: 0, onGround: true }; moveEntity(world, b, 0.6, 1.8, -1.2, 0, 0); return b.x; };
  const blocked = mover(s.world);
  // The same corridor in a world that has no moving block: nothing stops the mover.
  const plain = new World('plain'); for (let x = 55; x <= 70; x++) for (let z = 60; z <= 68; z++) for (let y = 9; y <= 14; y++) plain.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  assert.ok(mover(plain) < t.x + 0.75, 'free movement goes through the cell');
  assert.ok(Math.abs(blocked - (t.x + 0.8)) < 1e-6, `stopped at the moving head's face (0.5 into the cell), x=${blocked}`);
});

test('a push that lands a survival player applies the fall damage (EntityPlayerMP.updateFallState is empty natively; the damage comes with the landing)', () => {
  const s = fixture(), p = join(s, 'a', 'Alice', 1, { x: 60.5, y: 10.5, z: 64.5 });
  s.world.put(60, 13, 64, PISTON, 0, false); s.world.put(61, 13, 64, REDSTONE_BLOCK, 0, false); s.redstone.notifyBlocksOfNeighborChange?.(61, 13, 64, 0);
  p.survival.protection = 0; // the join's 3 second damage protection
  const hp = p.survival.health;
  s.tick(); p.survival.protection = 0;
  for (let i = 0; i < 8; i++) { s.tick(); if (!p.grounded) p.fallDistance = Math.max(p.fallDistance, 8); }
  assert.ok(p.survival.health < hp, `landing damage (health ${p.survival.health} of ${hp})`);
});

test('a minecart and a boat in the head cell are pushed', () => {
  const s = fixture(); powered(s);
  const cart = s.vehicles.carts.spawnCart(0, { x: 61.5, y: 10.35, z: 64.5, items: [] }, { born: true });
  const boat = s.vehicles.boats.spawnBoat({ x: 61.5, y: 10, z: 70.5 }, { born: true });
  s.world.put(60, 10, 70, PISTON, 5, false); s.world.put(60, 10, 69, REDSTONE_BLOCK, 0, false); s.redstone.notifyBlocksOfNeighborChange?.(60, 10, 69, 0);
  const x0 = cart.x, bx0 = boat.x;
  for (let i = 0; i < 6; i++) s.tick();
  assert.ok(cart.x > x0 + 0.5, `cart pushed, x ${x0} -> ${cart.x}`);
  assert.ok(boat.x > bx0 + 0.5, `boat pushed, x ${bx0} -> ${boat.x}`);
});

test('a client that comes in range while a tile is mid-move gets it once', () => {
  const s = fixture(), a = join(s, 'a', 'Alice', 1, { x: 64.5, y: 10, z: 70.5 }), b = join(s, 'b', 'Bob', 2, { x: 135.5, y: 10, z: 70.5 });
  s.world.put(135, 9, 70, 3, 0, false);
  powered(s);
  const got = { a: [], b: [] }, drain = () => { for (const [k, p] of [['a', a], ['b', b]]) { got[k].push(...(p.pistonOut ?? []).flatMap(m => m.tiles)); p.pistonOut = null; } };
  let moved = false;
  for (let i = 0; i < 8; i++) {
    s.tick(); drain();
    if (!moved && tilesNow(s).length) { b.position.copy({ x: 64.5, y: 10, z: 70.5 }); b.previous.copy(b.position); moved = true; }
  }
  assert.ok(moved);
  assert.equal(got.a.length, 1, 'Alice got the new tile once');
  assert.equal(got.b.length, 1, 'Bob, in range later, got the tile that was mid-move');
});

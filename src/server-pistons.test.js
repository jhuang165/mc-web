// Pistons on the gun server (multiplayer/server-pistons.js over the server's LiveRedstone): an extending piston pushes the
// players and mobs in front of it (TileEntityPiston.func_145863_a), the moving block collides for the server's movement
// (BlockPistonMoving.getCollisionBoundingBoxFromPool), each tick message carries the moving tiles a tab draws, a tile caught
// mid-motion survives a save and finishes after the reload, and one world's moving boxes never reach another dimension's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { during } from './multiplayer/server-pistons.js';
import { movingBoxes } from './moving-boxes.js';
import { installGunRules } from '../server/pack-loader.js';

await serverWorldReady;
await installGunRules();
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32);
const options = () => ({ config: { spawnMonsters: false, spawnAnimals: false, spawnProtection: 0 }, random: seeded(7) });
const STONE = 1, TORCH = 20, STICKY_PISTON = 116, PISTON = 117, PISTON_HEAD = 118, REDSTONE_BLOCK = 123, MOVING = 130;
const ORIGINAL_HEAD = 34, EAST = 5; // BlockPistonBase facing 5: +x
const IDLE = { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false };

// Alice on a stone floor in the sky, a piston at (x0, y, z0) facing east with `front` in front of it (nothing for 0). `fire`
// powers it with a redstone block behind it.
function arena(front = STONE) {
  const sim = new GunSimulation({ ...STREAMED, time: 6000 }, options());
  sim.mobs.ew.entities.length = 0;
  const a = sim.addPlayer('a', 'Alice', 'acct-a');
  const ax = Math.floor(a.position.x), az = Math.floor(a.position.z), y = 150;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) sim.world.put(ax + dx, y - 1, az + dz, STONE, 0);
  sim.teleport(a, { x: ax + 0.5, y, z: az + 0.5 });
  for (let i = 0; i < 3; i++) sim.tick();
  const x0 = ax - 4, z0 = az - 4;
  sim.world.set(x0, y, z0, PISTON, true, EAST);
  if (front) sim.world.set(x0 + 1, y, z0, front, true, front === TORCH ? 5 : 0);
  const fire = () => sim.world.set(x0 - 1, y, z0, REDSTONE_BLOCK, true, 0);
  const row = sim => [0, 1, 2].map(d => sim.world.get(x0 + d, y, z0));
  return { sim, a, ax, az, x0, y, z0, fire, row };
}
const run = (sim, n) => { for (let i = 0; i < n; i++) sim.tick(); };

test('an extending piston pushes the player standing in front of the block it moves', () => {
  const { sim, a, x0, y, z0, fire, row } = arena();
  sim.teleport(a, { x: x0 + 2.5, y, z: z0 + 0.5 });
  fire(); run(sim, 4);
  assert.deepEqual(row(sim), [PISTON, PISTON_HEAD, STONE]);
  assert.ok(a.position.x - x0 >= 3.3 - 1e-6, `pushed clear of the stone: ${a.position.x - x0}`);
  assert.ok(Math.abs(a.position.z - z0 - 0.5) < 1e-9 && Math.abs(a.position.y - y) < 1e-6, 'only along the facing');
});

test('an extending piston pushes a mob in front of it (the head alone, nothing to move)', () => {
  const { sim, x0, y, z0, fire } = arena(0);
  const pig = sim.mobs.ew.create('pig', x0 + 1.5, y, z0 + 0.5);
  pig.vx = pig.vy = pig.vz = 0; pig.wander = null;
  sim.mobs.ew.entities.push(pig);
  fire(); run(sim, 4);
  assert.equal(sim.world.get(x0 + 1, y, z0), PISTON_HEAD);
  assert.ok(pig.x - x0 > 2, `the head moved the pig out of its cell: ${pig.x - x0}`);
});

test('the moving block collides: a player walking into it stops at its side; without the boxes it walks through', () => {
  const walk = (boxes) => {
    const { sim, a, x0, y, z0, fire } = arena();
    fire(); sim.tick(); // the stone is now moving from x0 + 1 into x0 + 2
    if (!boxes) sim.pistons.boxes = () => [];
    // Hold the tiles halfway (the stone's box spans x0 + 1.5 .. x0 + 2.5 over the cell x0 + 2) while Alice walks north (-z)
    // past its south side; her column x0 + 1.7 .. x0 + 2.3 is inside the box's x span.
    sim.teleport(a, { x: x0 + 2, y, z: z0 + 2.5 });
    for (let i = 0; i < 20; i++) {
      for (const t of sim.redstone.pistonTiles()) t.progress = t.lastProgress = 0.5;
      sim.input(a.id, { controls: { ...IDLE, forward: 1 }, yaw: 0, pitch: 0, slot: a.survival.inventory.current });
      sim.tick();
    }
    assert.equal(sim.world.get(x0 + 2, y, z0), MOVING, 'still moving');
    return a.position.z - z0;
  };
  const stopped = walk(true);
  assert.ok(Math.abs(stopped - 1.3) < 1e-3, `stopped against the moving stone: ${stopped}`);
  assert.ok(walk(false) < 0, 'no moving-block collision');
});

test('the tick message carries the moving tiles while a block moves and drops them when it lands; so does the snapshot', () => {
  const { sim, x0, y, z0, fire } = arena();
  const quiet = sim.tick();
  assert.equal(quiet.redstone.pistons, undefined);
  assert.ok(Array.isArray(quiet.redstone.lit));
  fire();
  const first = sim.tick(), rows = first.redstone.pistons;
  assert.equal(rows.length, 2);
  const head = rows.find(r => r[0] === x0 + 1), stone = rows.find(r => r[0] === x0 + 2);
  assert.deepEqual(head.slice(0, 3), [x0 + 1, y, z0]);
  assert.equal(head[3], ORIGINAL_HEAD);
  assert.deepEqual(stone.slice(5), [EAST, 1, 0, 0.5, 0], 'facing, extending, renderHead, progress, lastProgress');
  assert.equal(sim.snapshot(sim.players.get('a').view).redstone.pistons.length, 2);
  assert.ok(first.changes.some(([x, yy, z, id]) => x === x0 + 2 && yy === y && z === z0 && id === MOVING), 'the tab gets the moving block cell');
  assert.deepEqual(sim.tick().redstone.pistons.map(r => r.slice(8)), [[1, 0.5], [1, 0.5]]);
  const landed = sim.tick();
  assert.equal(landed.redstone.pistons, undefined);
  assert.ok(landed.changes.some(([x, yy, z, id]) => x === x0 + 2 && yy === y && z === z0 && id === STONE));
});

test('a piston caught mid-motion is saved with the redstone and finishes after the reload', () => {
  const { sim, x0, y, z0, fire, row } = arena();
  fire(); sim.tick();
  assert.deepEqual(row(sim), [PISTON, MOVING, MOVING]);
  const saved = JSON.parse(JSON.stringify(sim.save()));
  const again = new GunSimulation(saved, options());
  assert.equal(again.pistons.tiles().length, 2);
  again.addPlayer('a', 'Alice', 'acct-a');
  assert.equal(again.tick().redstone.pistons.length, 2);
  run(again, 2);
  assert.deepEqual(row(again), [PISTON, PISTON_HEAD, STONE]);
  assert.equal(again.pistons.tiles().length, 0);
});

test('a piston breaking a torch drops it once (the redstone drop hook)', () => {
  const { sim, x0, y, z0, fire, row } = arena(TORCH);
  const before = sim.play.items.items.length;
  fire(); run(sim, 4);
  assert.deepEqual(row(sim), [PISTON, PISTON_HEAD, 0]);
  assert.deepEqual(sim.play.items.items.slice(before).map(i => [i.stack.id, i.stack.count]), [[TORCH, 1]]);
});

test('a sticky piston that loses power pulls its block back (BlockPistonBase retraction), the tab seeing it move', () => {
  const { sim, x0, y, z0, fire, row } = arena();
  sim.world.set(x0, y, z0, STICKY_PISTON, true, EAST);
  run(sim, 2);
  fire(); run(sim, 4);
  assert.deepEqual(row(sim), [STICKY_PISTON, PISTON_HEAD, STONE]);
  sim.world.set(x0 - 1, y, z0, 0, true, 0);
  const pull = sim.tick();
  assert.ok(pull.redstone.pistons?.some(r => r[0] === x0 + 1 && r[6] === 0), 'the stone moves back into x0 + 1 (retracting)');
  run(sim, 4);
  assert.deepEqual(row(sim), [STICKY_PISTON, STONE, 0]);
  assert.equal(sim.pistons.tiles().length, 0);
});

test("one world's moving blocks collide only while that world ticks: the Nether never sees the Overworld's", () => {
  const { sim, x0, y, z0, fire } = arena();
  const nether = sim.dims.get(-1);
  fire(); sim.tick();
  const box = [x0 + 1, y, z0, x0 + 3, y + 1, z0 + 1];
  assert.equal(movingBoxes(box).length, 0, 'no provider between ticks');
  assert.ok(during(sim, () => movingBoxes(box)).length > 0, "the Overworld's own boxes");
  assert.equal(during(nether, () => movingBoxes(box)).length, 0, "the Nether's (none)");
  // The Nether ticks inside the Overworld's turn on the gun server (ServerDimensions.tick runs after it, but nesting must hold).
  assert.deepEqual(during(sim, () => [during(nether, () => movingBoxes(box)).length, movingBoxes(box).length > 0]), [0, true]);
  assert.equal(movingBoxes(box).length, 0);
});

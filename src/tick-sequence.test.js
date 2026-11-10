// Executed fluid and falling-block tick sequences (batch 35 ticktree3), recorded by tools/verify-tick-sequence.mjs from the unchanged 1.7.10
// BlockDynamicLiquid / BlockStaticLiquid / BlockFalling classes under a 1000-per-tick scheduled-tick list, replayed through the port's tick tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SEQUENCES, replaySequence } from '../tools/tick-sequence-scenarios.mjs';

const reference = JSON.parse(fs.readFileSync(new URL('../public/research/tick-sequence-reference.json', import.meta.url)));

test('the reference was recorded from the unchanged 1.7.10 client and covers the scenarios', () => {
  assert.equal(reference.clientSha1, 'e80d9b3bf5085002218d4be59e668bac718abbc6');
  assert.deepEqual(Object.keys(reference.classes).sort(), ['akr', 'akx', 'alw', 'ali', 'ant', 'anh'].sort());
  assert.deepEqual(reference.scenarios.map((s) => s.name), SEQUENCES.map((s) => s.name));
  // More than 1000 entries come due in one tick in each scenario, so the cap spills over.
  for (const s of reference.scenarios) assert.ok(s.native.ticks.some(([taken]) => taken === 1000), `${s.name}: a tick hit the 1000 cap`);
  assert.ok(reference.scenarios[2].native.rng !== 0);
});

for (const [i, s] of SEQUENCES.entries()) {
  test(`${s.name}: the tick tree takes and runs the same entries, tick for tick, as the executed native sequence`, () => {
    const native = reference.scenarios[i].native, mine = replaySequence(s);
    mine.ticks.forEach((tick, t) => assert.deepEqual(tick, native.ticks[t], `tick ${t + 1} [taken, ran, taken-order hash, grid hash]`));
    assert.equal(mine.final, native.final, 'final grid');
    assert.equal(mine.pending, native.pending, 'pending entries');
    assert.equal(mine.pendingHash, native.pendingHash, 'pending entries (kind, cell, delay)');
    assert.equal(mine.rng, native.rng, 'world Random state');
  });
}

import { World, SAND, WATER } from '../src/world.js';
import { Fluids } from '../src/fluids.js';
import { FallingBlocks } from '../src/falling.js';
import { attachTickTree } from '../src/tile-ticks.js';

test('a fluid write notifies the falling block above it, as the native setBlock does (fluids write with world.put)', () => {
  const w = new World('fluid-notifies-sand');
  for (let x = 28; x < 36; x++) for (let z = 28; z < 36; z++) w.put(x, 9, z, 3, 0, false);
  w.put(32, 10, 32, 76, 0, false); // a torch holds the sand up (canFallBelow is false for it)
  w.put(32, 11, 32, SAND, 0, false);
  const fluids = new Fluids(w, { seed: 1 }), falling = new FallingBlocks(w, { drop() {} }, []);
  falling.watch();
  attachTickTree({ fluids, falling });
  assert.equal(falling.pending.size, 0);
  fluids.place(32, 10, 32, WATER, 0); // flowing water replaces the torch
  assert.equal(falling.pending.size, 1, 'the sand over the replaced cell is scheduled');
});

test('a flowing water cell whose entry was taken but not yet run is not rescheduled by a neighbour update', () => {
  const w = new World('inflight');
  for (let x = 28; x < 36; x++) for (let z = 28; z < 36; z++) w.put(x, 9, z, 3, 0, false);
  const fluids = new Fluids(w, { seed: 1 });
  w.put(32, 10, 32, WATER, 1, false); w.put(33, 10, 32, WATER, 1, false);
  fluids.schedule(32, 10, 32, 1); fluids.schedule(33, 10, 32, 1);
  fluids.beginTick();
  const a = fluids.take(), b = fluids.take();
  fluids.run(a); // a's update notifies b's cell, whose entry is already taken: flowing water, nothing to schedule
  const again = [...fluids.pending.values()].filter((e) => e.x === b.x && e.y === b.y && e.z === b.z);
  assert.equal(again.length, 0);
  fluids.run(b);
});

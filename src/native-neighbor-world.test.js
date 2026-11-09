// The generation-time power-state chains of the neighbour world (src/native-neighbor-world.js): the door's power toggle against the 80 native
// BlockDoor neighbour/power records of doors-panes-reference.json (tools/probes/DoorPaneProbe.java), and the power providers of redstone.js read
// through the structure world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PopulationArea, populationBlockMapperReady } from './population-world.js';
import { WorldChunkManager } from './biome-layers.js';
await populationBlockMapperReady;

const ref = JSON.parse(readFileSync(new URL('../public/research/doors-panes-reference.json', import.meta.url)));
const X = 8, Y = 64, Z = 8;
function area() {
  const manager = new WorldChunkManager(1n, 'default');
  const terrain = () => {
    const blocks = new Uint8Array(65536), metadata = new Uint8Array(65536);
    for (let c = 0; c < 256; c++) blocks.fill(1, c * 256, c * 256 + 64);
    return { blocks, metadata };
  };
  const a = new PopulationArea({ seed: 1n, chunkX: 0, chunkZ: 0, size: 1, terrain, biomeAt: (x, z) => manager.biomeAt(x, z), structures: true, manager, neighbors: true });
  a.world.chunk(0, 0);
  return a;
}
const cells = (w, ys) => ys.map((y) => [w.getBlock(X, y, Z), w.getBlockMetadata(X, y, Z)]);

test('door power toggle replays the native BlockDoor neighbour/power records', () => {
  const rows = ref.records.filter((r) => r.case === 'neighbour' && r.kind === 'power');
  assert.equal(rows.length, 80);
  for (const r of rows) {
    for (const [from, want] of [[0, r.fromLower], [1, r.fromUpper]]) {
      const w = area().world, set = new Set();
      if (r.powered & 1) set.add(Y);
      if (r.powered & 2) set.add(Y + 1);
      w.indirectlyPowered = (x, y) => set.has(y);
      w.setBlock(X, Y, Z, r.id, r.lower, 2); w.setBlock(X, Y + 1, Z, r.id, 8, 2);
      w.neighborChanged(r.id, X, Y + from, Z, r.changed);
      assert.deepEqual(cells(w, [Y, Y + 1]), want, `door ${JSON.stringify(r)} from ${from}`);
    }
  }
});

test('door power reads use the native-replayed providers instead of throwing', () => {
  // A lever (69, metadata bit 8 = on) beside the lower half powers the door directly (BlockLever weak power, replayed in redstone.js).
  for (const [provider, meta, side] of [[69, 8 | 1, [X - 1, Y, Z]], [69, 8 | 2, [X + 1, Y, Z]]]) {
    const w = area().world;
    w.setBlock(X, Y, Z, 64, 0, 2); w.setBlock(X, Y + 1, Z, 64, 8, 2);
    w.setBlock(...side, provider, meta, 2);
    assert.doesNotThrow(() => w.neighborChanged(64, X, Y, Z, provider));
    assert.equal(w.getBlockMetadata(X, Y, Z) & 4, 4, `lever ${meta} opens the door`);
  }
  // Unpowered lever: the door stays closed.
  const w = area().world;
  w.setBlock(X, Y, Z, 64, 0, 2); w.setBlock(X, Y + 1, Z, 64, 8, 2); w.setBlock(X - 1, Y, Z, 69, 1, 2);
  w.neighborChanged(64, X, Y, Z, 69);
  assert.equal(w.getBlockMetadata(X, Y, Z) & 4, 0);
});

test('a door that lost its support clears both halves and drops the door item once instead of throwing', () => {
  const w = area().world, items = [];
  w.onItem = (...a) => items.push(a);
  w.setBlock(X, 80, Z, 64, 0, 2); w.setBlock(X, 81, Z, 64, 8, 2);
  assert.doesNotThrow(() => w.neighborChanged(64, X, 80, Z, 64));
  assert.deepEqual(cells(w, [80, 81]), [[0, 0], [0, 0]]);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0].slice(3), [324, 1, 0, 10]);
});

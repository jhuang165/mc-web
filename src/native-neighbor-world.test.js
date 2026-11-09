// The generation-time power-state chains of the neighbour world (src/native-neighbor-world.js): the door's power toggle against the 80 native
// BlockDoor neighbour/power records of doors-panes-reference.json (tools/probes/DoorPaneProbe.java), and the power providers of redstone.js read
// through the structure world.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PopulationArea, populationBlockMapperReady } from './population-world.js';
import { WorldChunkManager } from './biome-layers.js';
import { JavaRandom } from './java-random.js';
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

// Fallen buttons and powered TNT against the 262 native cases of neighbor-chains-reference.json (tools/probes/NeighborChainProbe.java: the unchanged
// BlockButton and BlockTNT in the RedstoneProbe World/Chunk harness): final cell, the drop (position offsets from the world Random) or the primed TNT,
// and the next two Random draws, so the draw count matches.
test('fallen buttons and powered TNT replay the native neighbour chains', () => {
  const chains = JSON.parse(readFileSync(new URL('../public/research/neighbor-chains-reference.json', import.meta.url)));
  assert.equal(chains.cases.length, 262);
  let falls = 0, primes = 0;
  for (const c of chains.cases) {
    const w = area().world, items = [];
    w.rand = new JavaRandom(BigInt(c.seed));
    w.onItem = (...a) => items.push(a);
    const [x, y, z] = c.at;
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) w.setBlock(x + dx, y, z + dz, 0, 0, 2);
    w.setBlock(x, y + 1, z, 0, 0, 2); w.setBlock(x, y + 2, z, 0, 0, 2);
    if (c.id === 46) {
      w.setBlock(x, y, z, 46, 0, 2);
      if (c.mode === 1) w.setBlock(x + 1, y, z, 152, 0, 2);
      if (c.mode === 2) { w.setBlock(x, y + 1, z, 1, 0, 2); w.setBlock(x, y + 2, z, 152, 0, 2); }
      if (c.hook === 0) w.blockAdded(46, x, y, z); else w.neighborChanged(46, x, y, z, 1);
    } else {
      for (const [bit, dx, dz] of [[1, -1, 0], [2, 1, 0], [4, 0, -1], [8, 0, 1]]) if (c.mask & bit) w.setBlock(x + dx, y, z + dz, 1, 0, 2);
      w.setBlock(x, y, z, c.id, c.meta, 2);
      w.neighborChanged(c.id, x, y, z, 1);
    }
    assert.deepEqual([w.getBlock(x, y, z), w.getBlockMetadata(x, y, z)], [c.final, c.finalMeta], c.name);
    assert.equal(items.length, c.drops.length, `${c.name}: drops`);
    c.drops.forEach((d, i) => {
      assert.deepEqual([items[i][3], items[i][4], items[i][5]], [d[4], d[5], d[6]], c.name);
      assert.ok(Math.abs(items[i][0] - d[1]) < 1e-9 && Math.abs(items[i][1] - d[2]) < 1e-9 && Math.abs(items[i][2] - d[3]) < 1e-9, `${c.name}: drop position`);
    });
    assert.deepEqual((w.primedTnt ?? []).map((e) => [e.x, e.y, e.z, e.fuse]), c.primed, c.name);
    assert.deepEqual([Math.fround(w.rand.nextFloat()), Math.fround(w.rand.nextFloat())], c.next.map(Math.fround), `${c.name}: Random state`);
    falls += c.drops.length; primes += c.primed.length;
  }
  assert.ok(falls > 100 && primes === 2, `${falls} falls, ${primes} primed`);
});

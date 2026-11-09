// The gun server's streamed (infinite) world: per-player windows, residency, freezing, remembered writes, the client replica and
// migration of the finite arena's save (server-world.js, simulation.js, client.js ReplicaWorld, guns-server.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GunSimulation } from './multiplayer/gun-simulation.js';
import { ServerColumns, serverWorldReady, STREAMED_BIOME, STREAMED_GENERATION } from './multiplayer/server-world.js';
import { DedicatedClient, restoreReplica } from './multiplayer/client.js';
import { migrateToStreamed } from '../server/guns-server.js';

await serverWorldReady;
const STREAMED = { seed: 'ledoge0', biome: STREAMED_BIOME, generationVersion: STREAMED_GENERATION };
const same = (a, b) => a.blocks.length === b.blocks.length && a.blocks.every((v, i) => v === b.blocks[i]) && a.meta.every((v, i) => v === b.meta[i]);
// A worker that never answers: windows needing new cells are never ready.
const silentPort = () => ({ onmessage: null, onerror: null, postMessage() {}, terminate() {} });

test('a streamed gun world follows each player: the window moves, new columns go to that player, and the replica matches', () => {
  const sim = new GunSimulation(STREAMED); // no worker: cells are generated inline
  assert.ok(sim.world.streaming && sim.columns);
  const p = sim.addPlayer('a', 'Alice', 'acct-a');
  assert.deepEqual(p.view, sim.columns.windowAt(p.position.x, p.position.z));
  assert.equal(sim.frozen(p), false);
  const replica = restoreReplica(JSON.parse(JSON.stringify(sim.snapshot(p.view))));
  assert.equal(replica.chunks.size, 64);
  for (const c of replica.chunks.values()) assert.ok(same(c, sim.world.chunkAt(c.x, c.z)), `column ${c.x},${c.z}`);
  assert.equal(replica.biomeAt(p.position.x, p.position.z), sim.world.biomeAt(p.position.x, p.position.z));
  const before = { ...p.view };
  sim.teleport(p, { x: p.position.x + 16, y: 200, z: p.position.z });
  const tick = sim.tick();
  for (const [x, y, z, b, m] of tick.changes) replica.put(x, y, z, b, m, false); // the tick message first, as main.js applies it
  assert.deepEqual(p.view, { minX: before.minX + 16, minZ: before.minZ });
  const message = sim.drainColumns(p);
  assert.equal(message.type, 'columns');
  assert.equal(message.columns.length, 8, 'only the eight columns the tab lacks');
  assert.equal(sim.drainColumns(p), null);
  const change = replica.receive(message.window, JSON.parse(JSON.stringify(message.columns)));
  assert.equal(change.added.length, 8); assert.equal(change.removed.length, 8);
  for (const c of replica.chunks.values()) assert.ok(same(c, sim.world.chunkAt(c.x, c.z)), `column ${c.x},${c.z}`);
  // The replica moves only for the server: its own streamAround does nothing.
  assert.equal(replica.streamAround(p.position.x + 500, p.position.z), null);
  assert.throws(() => replica.receive({ minX: before.minX + 1000 * 16, minZ: 0 }, []), /Missing multiplayer column/);
  // The resident columns are the union of the player's window and the spawn chunks; a second player far away adds its own.
  const q = sim.addPlayer('b', 'Bob', 'acct-b');
  sim.teleport(q, { x: p.position.x - 400, y: 200, z: p.position.z });
  sim.tick();
  for (const [cx, cz] of sim.columns.keys(q.view)) assert.ok(sim.world.chunkAt(cx, cz));
  for (const [cx, cz] of sim.columns.keys(p.view)) assert.ok(sim.world.chunkAt(cx, cz));
  sim.removePlayer('b'); sim.tick();
  assert.ok(sim.world.chunks.size <= 128);
});

test('a player whose next window is not generated yet keeps its window and waits once past the ticking columns', () => {
  const sim = new GunSimulation(STREAMED, { port: silentPort() });
  const p = sim.addPlayer('a', 'Alice', 'acct-a'), view = { ...p.view };
  sim.teleport(p, { x: p.position.x + 3000, y: 120, z: p.position.z });
  for (let i = 0; i < 5; i++) sim.tick();
  assert.deepEqual(p.view, view, 'the window waits for its cells');
  assert.equal(sim.frozen(p), true);
  assert.equal(p.position.y, 120, 'no gravity over a column that is not there');
  assert.equal(sim.drainColumns(p), null);
});

test('untracked writes in a streamed world are remembered: a column that leaves and comes back is rebuilt as it was', () => {
  const sim = new GunSimulation(STREAMED);
  const p = sim.addPlayer('a', 'Alice', 'acct-a');
  sim.teleport(p, { x: p.position.x + 400, y: 230, z: p.position.z }); sim.tick();
  const cx = p.view.minX / 16 + 7, cz = p.view.minZ / 16 + 7, x = cx * 16 + 3, z = cz * 16 + 5;
  const spawnKeys = new Set([...sim.columns.keys(sim.columns.spawnWindow)].map(k => k.join(',')));
  assert.ok(!spawnKeys.has(`${cx},${cz}`), 'the test column is outside the spawn chunks');
  sim.world.put(x, 200, z, 1, 0, false); // e.g. a fluid or redstone write
  sim.world.put(x, 201, z, 3);
  sim.teleport(p, { x: p.position.x - 2000, y: 200, z: p.position.z }); sim.tick();
  assert.equal(sim.world.chunkAt(cx, cz), null, 'evicted');
  sim.teleport(p, { x: x, y: 230, z: z }); sim.tick();
  assert.equal(sim.world.get(x, 200, z), 1); assert.equal(sim.world.get(x, 201, z), 3);
  const saved = sim.save();
  assert.equal(saved.biome, STREAMED_BIOME); assert.ok(saved.claimed);
  const again = new GunSimulation(JSON.parse(JSON.stringify(saved)));
  again.addPlayer('a', 'Alice', 'acct-a');
  const back = again.accounts.get('acct-a');
  assert.ok(back);
  again.teleport(again.players.get('a'), { x, y: 230, z }); again.tick();
  assert.equal(again.world.get(x, 200, z), 1); assert.equal(again.world.get(x, 201, z), 3);
});

test('ServerColumns ticks a column only when its eight neighbours are resident', () => {
  const sim = new GunSimulation(STREAMED), w = sim.columns.spawnWindow;
  assert.equal(sim.world.isTicking(w.minX + 8, w.minZ + 8), false, 'the window edge');
  assert.equal(sim.world.isTicking(w.minX + 24, w.minZ + 24), true);
  assert.equal(ServerColumns.same(w, { ...w }), true);
});

test('columns that arrive while a tab loads are applied before the merged ticks, in order', () => {
  const seen = [];
  const client = new DedicatedClient({ onTick: m => seen.push(['tick', m.changes.length]), onColumns: m => seen.push(['columns', m.n]) });
  client.buffer({ type: 'tick', tick: 1, changes: [[0, 0, 0, 1, 0]], players: [] });
  client.buffer({ type: 'columns', n: 1 });
  client.buffer({ type: 'tick', tick: 2, changes: [[0, 0, 0, 2, 0]], players: [] });
  client.buffer({ type: 'columns', n: 2 });
  client.start();
  assert.deepEqual(seen, [['columns', 1], ['columns', 2], ['tick', 1]]);
  client.apply({ type: 'columns', n: 3 });
  assert.deepEqual(seen.at(-1), ['columns', 3]);
});

test('a finite arena save becomes a streamed world: accounts keep their items at the new spawn, the old file is kept', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mc-stream-')), file = path.join(dir, 'world.json');
  try {
    const old = { version: 2, seed: 'ledoge0', biome: 'java', generationVersion: 9, edits: [['1,2,3', 4]], time: 9000, rules: { keepInventory: true },
      accounts: [['acct', { name: 'Alice', mode: 'survival', position: { x: 1, y: 2, z: 3 }, player: { health: 7 } }]], play: { items: [] } };
    await writeFile(file, JSON.stringify(old));
    const next = await migrateToStreamed(old, file);
    assert.equal(next.biome, STREAMED_BIOME); assert.equal(next.generationVersion, STREAMED_GENERATION); assert.equal(next.seed, 'ledoge0');
    assert.equal(next.edits, undefined); assert.equal(next.play, undefined); assert.equal(next.time, 9000); assert.deepEqual(next.rules, { keepInventory: true });
    assert.deepEqual(next.accounts, [['acct', { name: 'Alice', mode: 'survival', player: { health: 7 } }]]);
    assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'world.finite.json'), 'utf8')), old);
    assert.equal(await migrateToStreamed(next, file), next, 'a streamed save is left alone');
    assert.deepEqual(await migrateToStreamed({}, file), STREAMED);
    const sim = new GunSimulation(next);
    const p = sim.addPlayer('a', 'Alice', 'acct');
    assert.equal(p.survival.health, 7);
    assert.ok(Math.abs(p.position.x - sim.worldSpawn().x) < 32, 'at the new world spawn');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ChunkKeySet, ChunkProviderServer, prepareSpawnArea, saveAllChunks, tickChunks } from "./chunk-provider.js";
import { PlayerManager, createChunkViewer } from "./player-chunks.js";
import { Chunk, EmptyChunk, chunkKey } from "./chunk-store.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/chunk-provider-reference.json", import.meta.url)));
const records = (kind) => reference.records.filter((r) => r.kind === kind);

test("the unload queue iterates in ConcurrentHashMap order through resizes, tree bins and removals", () => {
  const sets = records("set");
  assert.deepEqual(sets.map((s) => s.name), ["wide", "square", "collide", "split", ...[0, 1, 2, 3, 4, 5].map((i) => `cluster${i}`)]);
  let treeBins = 0;
  for (const s of sets) {
    const set = new ChunkKeySet(), orders = new Map(s.orders.map(([i, order]) => [i, order]));
    s.ops.forEach(([op, x, z], i) => {
      if (op === 0) set.add(x, z);
      else if (op === 1) assert.equal(set.delete(x, z), true);
      else {
        assert.deepEqual(set.first(), [x, z], `${s.name} op ${i}: first`);
        set.delete(x, z);
      }
      if (set.table) treeBins = Math.max(treeBins, set.table.filter((b) => b && b.tree).length);
      if (orders.has(i)) assert.deepEqual([...set].flat(), orders.get(i), `${s.name} order after op ${i}`);
    });
    assert.equal(set.size, orders.get(s.ops.length - 1).length / 2);
  }
  assert.ok(treeBins > 0, "the colliding keys build tree bins");
});

test("repeated adds, emptied bins and the presize of a small table", () => {
  const set = new ChunkKeySet();
  assert.equal(set.first(), null);
  assert.equal(set.add(3, 3), true);
  assert.equal(set.add(3, 3), false);
  assert.equal(set.size, 1);
  assert.equal(set.delete(3, 3), true);
  assert.equal(set.delete(3, 3), false);
  assert.equal(set.first(), null);
  // Nine keys with hash 0 (x == z) in one bin of a 16-bin table: the ninth presizes to 128 bins.
  for (let i = 0; i < 9; i++) set.add(i, i);
  assert.equal(set.table.length, 128);
  assert.equal(set.table[0].tree, undefined);
});

// Mirrors the probe's stub loader, generator and chunk hooks.
function replay(rec) {
  const events = [], saved = new Map();
  const world = {
    totalTime: 0, spawnX: rec.spawn[0], spawnZ: rec.spawn[1], canRespawnHere: rec.respawn, hasNoSky: true, levelSaving: false, findingSpawnPoint: false,
    chunkLoaded: (c) => events.push(`+ ${c.x} ${c.z}`),
    chunkUnloaded: (c) => events.push(`- ${c.x} ${c.z}`),
  };
  const loader = {
    load(x, z) {
      const s = saved.get(chunkKey(x, z));
      events.push(`L ${x} ${z} ${s ? 1 : 0}`);
      return s ? Object.assign(new Chunk(x, z, false), s) : null;
    },
    save(c) {
      events.push(`S ${c.x} ${c.z}`);
      saved.set(chunkKey(c.x, c.z), { isTerrainPopulated: c.isTerrainPopulated, isLightPopulated: c.isLightPopulated, inhabitedTime: c.inhabitedTime, hasEntities: c.hasEntities });
    },
    saveExtra: (c) => events.push(`X ${c.x} ${c.z}`),
    tick: () => events.push("T"),
    flush: () => events.push("E"),
  };
  const generator = {
    provideChunk(x, z) { events.push(`G ${x} ${z}`); return new Chunk(x, z, false); },
    populate: (p, x, z) => events.push(`P ${x} ${z}`),
    recreateStructures: (x, z) => events.push(`R ${x} ${z}`),
  };
  const provider = new ChunkProviderServer(world, loader, generator), manager = new PlayerManager(provider, rec.view), players = new Map();
  assert.equal(manager.playerViewRadius, rec.view);
  const expected = {};
  rec.steps.forEach((step, n) => {
    const [kind, ...a] = step.op, where = `${rec.name} step ${n} ${JSON.stringify(step.op)}`;
    switch (kind) {
      case "prepare": prepareSpawnArea(provider); break;
      case "add": players.set(a[0], createChunkViewer(a[1], a[2])); manager.addPlayer(players.get(a[0])); break;
      case "move": { const p = players.get(a[0]); p.posX = a[1]; p.posZ = a[2]; manager.updatePlayerPertinentChunks(p); break; }
      case "remove": manager.removePlayer(players.get(a[0])); players.delete(a[0]); break;
      case "view": manager.setViewDistance(a[0]); break;
      case "tick": for (let i = 0; i < a[0]; i++) tickChunks(provider, manager); break;
      case "save": saveAllChunks(provider, manager, a[0] !== 0); break;
      case "unloadAll": provider.unloadAllChunks(); break;
      case "queue": provider.unloadChunksIfNotNearSpawn(a[0], a[1]); break;
      case "load": provider.loadChunk(a[0], a[1]); break;
      case "provide": { const c = provider.provideChunk(a[0], a[1]); events.push(c instanceof EmptyChunk ? "empty" : `chunk ${c.x} ${c.z}`); break; }
      case "loadOnRequest": provider.loadChunkOnProvideRequest = a[0] !== 0; break;
      case "modify": provider.provideChunk(a[0], a[1]).modified = true; break;
      case "entities": provider.provideChunk(a[0], a[1]).hasEntities = a[2] !== 0; break;
      case "saving": world.levelSaving = a[0] !== 0; break;
      default: throw new Error(kind);
    }
    for (const f of ["loaded", "queue", "watchers", "sends"]) if (step[f] !== null) expected[f] = step[f];
    assert.equal(world.totalTime, step.time, where);
    assert.deepEqual(events.splice(0), step.events, `${where}: events`);
    const flags = (c) => (c.isTerrainPopulated ? 1 : 0) | (c.isLightPopulated ? 2 : 0) | (c.modified ? 4 : 0) | (c.hasEntities ? 8 : 0) | (c.isChunkLoaded ? 16 : 0);
    assert.deepEqual(provider.loadedChunks.flatMap((c) => [c.x, c.z, flags(c), c.lastSaveTime, c.inhabitedTime]), expected.loaded, `${where}: loaded chunks`);
    assert.deepEqual([...provider.chunksToUnload].flat(), expected.queue, `${where}: unload queue`);
    assert.deepEqual(manager.playerInstanceList.flatMap((i) => [i.location.x, i.location.z, i.players.length, i.previousWorldTime]), expected.watchers, `${where}: watchers`);
    const sends = Object.fromEntries([...players].sort((p, q) => p[0] - q[0]).map(([id, p]) => [id, p.loadedChunks.flatMap((c) => [c.x, c.z])]));
    assert.deepEqual(sends, expected.sends, `${where}: send queues`);
    assert.equal(manager.players.length, step.players, where);
    assert.equal(manager.playerViewRadius, step.radius, where);
    assert.equal(provider.chunks.size, provider.loadedChunks.length);
  });
  return { provider, manager, saved };
}

for (const name of ["spawn", "walk", "teleport", "noRespawn", "view", "save", "inhabit"])
  test(`ChunkProviderServer and PlayerManager replay the original ${name} scenario`, () => {
    const rec = records("scenario").find((r) => r.name === name);
    assert.ok(rec);
    replay(rec);
  });

test("unloaded chunks come back with their saved state and are not populated again", () => {
  const rec = records("scenario").find((r) => r.name === "teleport");
  const { saved } = replay(rec);
  assert.ok(saved.size > 400);
  const populated = rec.steps.flatMap((s) => s.events).filter((e) => e.startsWith("P "));
  assert.equal(new Set(populated).size, populated.length, "each chunk is decorated once across unload and reload");
  const reloads = rec.steps.flatMap((s) => s.events).filter((e) => e.startsWith("L ") && e.endsWith(" 1")).length;
  const recreated = rec.steps.flatMap((s) => s.events).filter((e) => e.startsWith("R ")).length;
  assert.equal(reloads, recreated, "every chunk from the loader recreates its structures");
  assert.ok(reloads > 100);
});

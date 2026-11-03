import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ChunkProviderGenerate, BiomeTerrainState } from "./terrain-generator.js";
import { MapGenCaves, MapGenRavine, randomLong } from "./mapgen.js";
import { StructurePopulationArea } from "./structure-population-area.js";

const reference = JSON.parse(readFileSync(new URL("../public/research/structure-population-world-reference.json", import.meta.url)));
const fixtures = reference.records;
const bits = (n) => { const b = Buffer.alloc(4); b.writeFloatLE(n); return b.readInt32LE(); };
const stack = (s) => s ? [s[0], s[1], s[2], (s[3] ?? []).map(([id, level]) => [id, level])] : null;

function terrainSource(seed, type) {
  const state = new BiomeTerrainState(), gen = new ChunkProviderGenerate(seed, type, state), manager = gen.manager;
  const top = (x, z) => state.topBlock(manager.biomeAt(x, z));
  const caves = new MapGenCaves(seed, manager, top), ravines = new MapGenRavine(seed, manager, top), cache = new Map();
  const terrain = (x, z) => {
    const k = `${x},${z}`; let chunk = cache.get(k);
    if (!chunk) {
      const c = gen.provideChunk(x, z); caves.generate(x, z, c.blocks); ravines.generate(x, z, c.blocks);
      chunk = { blocks: c.blocks.slice(), metadata: c.metadata.slice() }; cache.set(k, chunk);
    }
    return chunk;
  };
  return { terrain, manager };
}

function tiles(world) {
  const out = [];
  for (const c of world.chunks.values()) for (const t of c.tiles.values()) {
    if (t.kind === "chest") out.push([t.x, t.y, t.z, "chest", world.getBlockMetadata(t.x, t.y, t.z), t.slots.map(stack)]);
    else if (t.kind === "spawner") out.push([t.x, t.y, t.z, "spawner", t.name]);
  }
  return out.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
}
function entities(world) {
  return world.animals.map((e) => e.type === "Villager"
    ? ["Villager", e.x, e.y, e.z, 0, e.profession]
    : [e.name, e.x, e.y, e.z, bits(e.yaw), -1]);
}

test("combined structure population replays native provider writes and side effects", () => {
  assert.equal(fixtures.length, 5);
  const exercised = new Set(); let totalWrites = 0;
  for (const rec of fixtures) {
    const seed = BigInt(rec.seed), [x, z] = rec.chunk;
    const { terrain, manager } = terrainSource(seed, rec.type);
    const area = new StructurePopulationArea({ seed, chunkX: x, chunkZ: z, terrain, manager }).run();
    area.world.onCall = null; area.world.onWrite = null;
    const row = area.steps[0], nativeStep = rec.steps[0];
    assert.deepEqual(Object.keys(area.population.generators), rec.searchOrder);
    assert.equal(area.searchRows[0].inputSha1, rec.inputSha1, `native provideChunk bytes ${rec.seed} ${x},${z}`);
    assert.deepEqual(area.order, [[x, z]]);
    assert.equal(row.writeCount, nativeStep.writeCount, `ordered writes ${rec.seed} ${x},${z}`);
    assert.equal(row.writesSha1, nativeStep.writesSha1, `ordered write hash ${rec.seed} ${x},${z}`);
    // BlockTNT.onBlockAdded reads (indirect power) closed the old 319-call desert temple gap.
    assert.equal(row.callCount, nativeStep.callCount, `ordered world calls ${rec.seed} ${x},${z}`);
    assert.equal(row.callsSha1, nativeStep.callsSha1, `ordered call hash ${rec.seed} ${x},${z}`);
    assert.equal(row.nextLong, nativeStep.providerNextLong, `provider Random ${rec.seed} ${x},${z}`);
    assert.equal(row.village, nativeStep.populateResults.includes("village:true"), `village gate ${rec.seed} ${x},${z}`);
    assert.equal(randomLong(area.world.rand).toString(), rec.worldNextLong, `World.rand ${rec.seed} ${x},${z}`);
    assert.deepEqual(tiles(area.world), rec.tiles, `tiles and loot ${rec.seed} ${x},${z}`);
    assert.deepEqual(entities(area.world), rec.entities, `entities ${rec.seed} ${x},${z}`);
    assert.deepEqual(area.world.carts.map((e) => [e.x, e.y, e.z, e.slots.map(stack)]), rec.carts, `carts ${rec.seed} ${x},${z}`);
    assert.deepEqual(area.world.pending, rec.pending, `pending ticks ${rec.seed} ${x},${z}`);
    assert.deepEqual(area.world.items, rec.drops, `drops ${rec.seed} ${x},${z}`);
    if (row.village) assert.ok(row.events.every(([kind]) => kind === "dungeon"), "village suppresses water and lava lakes");
    const chunk = area.world.chunk(x, z), hash = createHash("sha1"), cell = Buffer.alloc(4);
    for (let ix = 0; ix < 16; ix++) for (let iz = 0; iz < 16; iz++) for (let y = 0; y < 256; y++) {
      cell.writeInt32LE(chunk.getBlock(ix, y, iz) | chunk.getMeta(ix, y, iz) << 12); hash.update(cell);
    }
    assert.equal(hash.digest("hex"), rec.areaSha1, `final native chunk ${rec.seed} ${x},${z}`);
    assert.deepEqual(area.searchRows[0].starts, Object.fromEntries(Object.entries(rec.starts).map(([k, v]) => [k, v.length])));
    for (const [name, generator] of Object.entries(area.population.generators)) {
      const starts = generator.structureMap.values().map((s) => [[s.chunkX, s.chunkZ], s.boundingBox.toArray(), s.components.length]);
      assert.deepEqual(starts, rec.starts[name], `${name} starts ${rec.seed} ${x},${z}`);
      if (rec.starts[name].length && row.writeCount > 0) exercised.add(name);
    }
    totalWrites += row.writeCount;
  }
  assert.deepEqual([...exercised].sort(), ["mineshaft", "scatteredFeature", "stronghold", "village"]);
  assert.equal(totalWrites, fixtures.reduce((n, r) => n + r.steps[0].writeCount, 0));
});

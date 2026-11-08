// Population of imported chunks the Java save never populated (remaining-gaps Priority 5, batch 27).
//
// Natively an unpopulated chunk (TerrainPopulated=false) is populated by Chunk.populateChunk the moment it and its +x, +z and
// +x+z neighbours are loaded: ChunkProviderServer.populate sets the flag and runs ChunkProviderGenerate.populate (or
// ChunkProviderFlat.populate) with the world seed. This module applies that rule over the set of stored columns of a whole-save
// import, with the same ported chain the streamed generator uses (PopulationArea: structure start search, lakes, dungeons, decorators,
// animals, snow), then writes the changed cells back into the stored columns and sets TerrainPopulated=true.
//
// Rules (public/research/region-import.md "Populating imported chunks"):
//   - candidates are the stored overworld columns with TerrainPopulated=false whose three neighbours are stored; the order is the
//     native load order of the stored set (x outer, z inner) replayed through Chunk.populateChunk's four checks (populationPlan);
//   - a populated chunk is never populated again; its cells only change where a neighbour's overhang writes into it, exactly as
//     natively (native world.chunk writes);
//   - terrain a populate reads from a chunk that is not stored is the generator's own terrain, caves and ravines included (the halo,
//     lazy, writes discarded: the browser populates that column itself when it generates it);
//   - only cells the populate changed are written, through fromOriginal (cells that did not change keep their stored state, which the
//     original-id round trip would lose for chest and furnace facing, flowing fluid and lit furnaces); a populate that would write an
//     original block the registry has no exact cell for is skipped as a whole and reported;
//   - chests, dispensers and spawners (dungeons, mineshafts, temples) and generation-time liquid ticks join the world record;
//     animals, swamp-hut pots and village NPCs are counted as dropped (their runtimes belong to entities.js / stone-utility.js).
import { PopulationArea, structureTileRecords } from "./population-world.js";
import { JavaRandom } from "./java-random.js";
import { populateBeforeDecoration } from "./population-stage.js";
import { populateTail } from "./population-tail.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { encodeBaseColumn, decodeBaseColumn } from "./whole-save-columns.js";
import { itemFromOriginal } from "./region-import.js";
import { makeStack } from "./inventory.js";
import { EntityWorld, ENTITY_TYPES } from "./entities.js";
import { villagerFields } from "./villager.js";
import { dimensionRunner } from "./imported-population-dims.js";

const key = (x, z) => `${x},${z}`;
const CHEST_ID = 54, DISPENSER_ID = 23, LIQUIDS = new Set([8, 9, 10, 11]);
// Scheduled ticks kept as runtime queues (fluid, fire, falling blocks), by original block id.
const TICK_LISTS = { 8: "fluidTicks", 9: "fluidTicks", 10: "fluidTicks", 11: "fluidTicks", 51: "fireTicks", 12: "fallingTicks", 13: "fallingTicks" };
const MOBS = { Pig: "pig", Cow: "cow", MushroomCow: "mooshroom", Sheep: "sheep", Chicken: "chicken", Wolf: "wolf", EntityHorse: "horse", Villager: "villager", Witch: "witch", ender_crystal: "ender_crystal", ender_dragon: "ender_dragon" };
let entityFactory = null;
/** A populate-time mob ({name|type, x, y, z, yaw, fleece, profession}) as a runtime entity record in local coordinates. */
export function entityRecord(e, ox = 0, oz = 0) {
  const type = MOBS[e.type === "Villager" || e.type === "Witch" ? e.type : e.name ?? e.type];
  if (!type || !ENTITY_TYPES[type]) return null;
  entityFactory ??= new EntityWorld(null, [], () => 0.5);
  const m = entityFactory.create(type, e.x - ox, e.y, e.z - oz);
  if (type === "villager") Object.assign(m, villagerFields(e.profession, 0));
  else if (e.yaw !== undefined && type !== "witch" && type !== "ender_crystal") m.yaw = Math.fround(e.yaw * Math.PI / 180);
  if (type === "sheep") m.color = e.fleece;
  return entityFactory.serializeOne(m);
}
const CACHE_MAX = 96, CACHE_KEEP = 48, RETRY = 8, BATCH = 16;

/**
 * Chunk.populateChunk replayed over a set of loaded chunks, in the order chunks are loaded (x outer, z inner, the order the native
 * server loads a rectangle). `chunks`: [[x, z, populated]] (native chunk coordinates). Returns the populate calls in order,
 * [[x, z]], that ChunkProviderServer.populate would make; a chunk is marked populated by its own call, as natively.
 * Runtime never populates a chunk twice and never populates one whose +x/+z/+x+z neighbours are missing.
 */
export function populationPlan(chunks) {
  const flags = new Map(chunks.map(([x, z, populated]) => [key(x, z), !!populated])), loaded = new Set(), calls = [];
  const has = (x, z) => loaded.has(key(x, z));
  const call = (x, z) => { flags.set(key(x, z), true); calls.push([x, z]); };
  for (const [x, z] of [...chunks].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    loaded.add(key(x, z));
    // apx.a(apu, apu, int, int): the chunk itself, then (x-1, z), (x, z-1), (x-1, z-1), each only while unpopulated.
    if (!flags.get(key(x, z)) && has(x + 1, z + 1) && has(x, z + 1) && has(x + 1, z)) call(x, z);
    if (has(x - 1, z) && !flags.get(key(x - 1, z)) && has(x - 1, z + 1) && has(x, z + 1) && has(x - 1, z)) call(x - 1, z);
    if (has(x, z - 1) && !flags.get(key(x, z - 1)) && has(x + 1, z - 1) && has(x, z - 1) && has(x + 1, z)) call(x, z - 1);
    if (has(x - 1, z - 1) && !flags.get(key(x - 1, z - 1)) && has(x, z - 1) && has(x - 1, z - 1) && has(x - 1, z)) call(x - 1, z - 1);
  }
  return calls;
}

/**
 * One native populate call over `terrain(x, z)` -> {blocks, metadata} (original ids, (lx * 16 + lz) * 256 + y) for any chunk the
 * call touches. `population` is the world's StreamingPopulation (seed, biome source, structure cache, flat info, MapFeatures).
 * The four chunks of the populate window search their structure starts first (all 64 searches precede population in the native
 * area runs; here the start of any structure that can reach the window is within the 8-chunk search radius of one of its chunks).
 * Returns the PopulationArea; its `world.chunks` hold every chunk the call touched.
 */
export function populateOne(population, x, z, terrain) {
  const pass = new PopulationArea({
    seed: population.seed, chunkX: x, chunkZ: z, size: 0, terrain, biomeAt: population.biomeAt,
    structures: !!population.structureCache, manager: population.structureCache?.manager, structureCache: population.structureCache,
    flat: population.flat, mapFeatures: population.mapFeatures,
  });
  const w = pass.world;
  for (let a = x - 1; a <= x + 2; a++) for (let b = z - 1; b <= z + 2; b++) {
    if (pass.structures) { w.chunk(a, b); pass.structures.searchChunk(a, b); }
    else { if (pass.mapFeatures) pass.mineshafts.generate(a, b); w.chunk(a, b); }
  }
  const r = new JavaRandom(pass.seed);
  const result = pass.structures ? pass.structures.populateChunk(r, x, z)
    : populateBeforeDecoration(w, r, pass.seed, x, z, { structures: pass.mapFeatures ? (random, a, b) => { pass.mineshafts.generateStructuresInChunk(w, random, a, b); return false; } : null });
  if (pass.flat) { if (pass.flat.has("decoration")) pass.decoration.decorate(w, r, result.biome.slot, x * 16, z * 16); }
  else populateTail(w, r, pass.decoration, x, z, result.biome.slot);
  pass.order.push([x, z]);
  return pass;
}

class NeedChunk extends Error { constructor(x, z) { super(`need stored chunk ${x},${z}`); this.need = [x, z]; } }

/**
 * Populate the unpopulated stored columns of the Overworld.
 * options: population (StreamingPopulation of the world), origin {chunkX, chunkZ} (local chunk = native - origin), worldKey (BASES key),
 * coords [[lx, lz]] every stored overworld column, unpopulated [[lx, lz]] those with TerrainPopulated=false,
 * read(worldKey, [[x, z]]) -> records, write(records), onProgress({phase: "populate", done, total}), signal,
 * exactInput(nativeX, nativeZ) -> {blocks, metadata} original arrays to use instead of the stored cells (tests: isolates the
 * flowing-fluid state a stored cell cannot keep),
 * observe(nativeX, nativeZ, {blocks, metadata}) called with the original-id arrays of every chunk written back (tests).
 * Returns {populated, skipped: {...}, tiles: {chests, dispensers}, spawners, carts, fluidTicks, dropped: {...}, ms}.
 */
export async function populateImportedColumns({ population, origin, worldKey, coords, unpopulated, read, write, onProgress = () => {}, signal, mapBlock = fromOriginal, observe = null, exactInput = null, dimension = 0, seed = 0n }) {
  const runner = dimension ? dimensionRunner(dimension, seed) : null;
  const started = Date.now(), ox = origin.chunkX * 16, oz = origin.chunkZ * 16;
  const out = { populated: 0, calls: 0, skipped: { noNeighbours: 0, unmapped: 0, failed: 0 }, chests: {}, dispensers: {}, spawners: [], carts: [], fluidTicks: [], dropped: { animals: 0, pots: 0, villagers: 0, ticks: 0 }, kept: { animals: 0, villagers: 0 }, droppedTickIds: {}, entities: [], pots: [], fireTicks: [], fallingTicks: [], unmappedCells: 0, changedCells: 0, retries: 0, reads: 0, ms: 0 };
  const stored = new Set(coords.map(([x, z]) => key(x + origin.chunkX, z + origin.chunkZ)));
  const flagged = new Set(unpopulated.map(([x, z]) => key(x + origin.chunkX, z + origin.chunkZ)));
  const plan = populationPlan(coords.map(([x, z]) => [x + origin.chunkX, z + origin.chunkZ, !flagged.has(key(x + origin.chunkX, z + origin.chunkZ))]));
  out.skipped.noNeighbours = flagged.size - new Set(plan.map(([x, z]) => key(x, z))).size;
  const cache = new Map();
  let pending = [];
  const flush = async () => { if (pending.length) { const batch = pending; pending = []; await write(batch); } };
  const toOrig = new Map();
  // A still fluid never carries a level, so a stored fluid cell with a level is a flowing one.
  const origin1 = (id, meta) => {
    const k = id << 4 | meta;
    let v = toOrig.get(k);
    if (v === undefined) { const o = toOriginal(id, meta, { flowing: meta !== 0 }); v = o ? o[0] << 4 | (o[1] & 15) : -1; toOrig.set(k, v); }
    return v;
  };
  const load = async (list) => {
    const want = list.filter(([x, z]) => stored.has(key(x, z)) && !cache.has(key(x, z)));
    if (!want.length) return;
    await flush();
    const records = await read(worldKey, want.map(([x, z]) => [x - origin.chunkX, z - origin.chunkZ]));
    out.reads += want.length;
    want.forEach(([x, z], i) => {
      const record = records[i];
      if (!record) throw new Error(`Stored column ${x - origin.chunkX},${z - origin.chunkZ} disappeared during population`);
      const decoded = decodeBaseColumn(record), orig = { blocks: new Uint8Array(65536), metadata: new Uint8Array(65536) };
      for (let i2 = 0; i2 < 65536; i2++) {
        const v = decoded.blocks[i2] | decoded.metadata[i2] << 8;
        if (!v) continue;
        const o = origin1(decoded.blocks[i2], decoded.metadata[i2]);
        if (o < 0) { out.unmappedCells++; continue; }
        orig.blocks[i2] = o >> 4; orig.metadata[i2] = o & 15;
      }
      for (const [i3, k] of decoded.overlay) { orig.blocks[i3] = k >> 4; orig.metadata[i3] = k & 15; }
      const exact = exactInput?.(x, z);
      if (exact) { orig.blocks.set(exact.blocks); orig.metadata.set(exact.metadata); }
      cache.set(key(x, z), { x, z, decoded, orig, overlay: decoded.overlay });
    });
  };
  const trim = (keep) => {
    if (cache.size <= CACHE_MAX) return;
    for (const k of [...cache.keys()]) { if (cache.size <= CACHE_KEEP) break; if (!keep.has(k)) cache.delete(k); }
  };
  const entryChange = (entry, changes) => {
    for (const [i, id, meta, m] of changes) {
      entry.orig.blocks[i] = id; entry.orig.metadata[i] = meta; entry.decoded.blocks[i] = m.id; entry.decoded.metadata[i] = m.meta;
      // The cell cannot tell the original apart when the registry would imply another one: keep the exact original in the overlay.
      const key2 = id << 4 | meta;
      if (origin1(m.id, m.meta) === key2) entry.overlay.delete(i); else entry.overlay.set(i, key2);
    }
  };
  const commit = (entry, populated) => {
    const cells = new Uint16Array(65536);
    for (let i = 0; i < 65536; i++) cells[i] = entry.decoded.blocks[i] | entry.decoded.metadata[i] << 8;
    if (populated) entry.decoded.terrainPopulated = true;
    observe?.(entry.x, entry.z, entry.orig);
    pending.push(encodeBaseColumn(worldKey, entry.x - origin.chunkX, entry.z - origin.chunkZ, cells, { biomes: entry.decoded.biomes, terrainPopulated: entry.decoded.terrainPopulated, lightPopulated: entry.decoded.lightPopulated, overlay: entry.overlay }));
  };
  const dropTile = (lx, y, lz) => {
    const k = `${lx},${y},${lz}`;
    for (const name of ["chests", "dispensers"]) if (out[name][k]) { delete out[name][k]; }
    out.spawners = out.spawners.filter((s) => !(s.x === lx && s.y === y && s.z === lz));
  };

  for (const [index, [x, z]] of plan.entries()) {
    if (signal?.aborted) throw new DOMException("Import cancelled", "AbortError");
    const needed = [];
    if (runner) needed.push(...runner.window(x, z));
    else for (let a = x - 1; a <= x + 2; a++) for (let b = z - 1; b <= z + 2; b++) needed.push([a, b]);
    await load(needed);
    let pass = null;
    const mark = runner?.mark();
    for (let attempt = 0; ; attempt++) {
      try {
        pass = runner
          ? runner.run(x, z, (a, b) => {
            const entry = cache.get(key(a, b));
            if (entry) return entry.orig;
            if (stored.has(key(a, b))) throw new NeedChunk(a, b);
            return null;
          })
          : populateOne(population, x, z, (a, b) => {
            const entry = cache.get(key(a, b));
            if (entry) return entry.orig;
            if (stored.has(key(a, b))) throw new NeedChunk(a, b);
            return population.original(a, b);
          });
        break;
      } catch (error) {
        runner?.reset(mark);
        if (error instanceof NeedChunk && attempt < RETRY) { out.retries++; await load([error.need]); continue; }
        pass = null; out.skipped.failed++;
        if (!(error instanceof NeedChunk) && out.errors?.length !== 8) (out.errors ??= []).push(`${x},${z}: ${error.message}`);
        break;
      }
    }
    if (!pass) continue;
    const w = pass.world;
    // Diff every stored chunk the call touched against its input; refuse the populate when a result has no exact cell.
    const changes = new Map();
    let refuse = false;
    for (const c of (runner ? pass.chunks : w.chunks).values()) {
      const entry = cache.get(key(c.x, c.z));
      if (!entry) continue;
      const list = [];
      if (runner) {
        for (let i = 0; i < 65536; i++) {
          const id = c.blocks[i], meta = c.metadata[i];
          if (id === entry.orig.blocks[i] && meta === entry.orig.metadata[i]) continue;
          const m = mapBlock(id, meta);
          if (!m?.exact || m.id > 255) { refuse = true; out.unmappedCells++; break; }
          list.push([i, id, meta, m]);
        }
        if (refuse) break;
        if (list.length) changes.set(key(c.x, c.z), list);
        continue;
      }
      for (let s = 0; s < 16 && !refuse; s++) {
        const section = c.sections[s];
        if (!section) continue;
        for (let ly = 0; ly < 16; ly++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
          const j = ly << 8 | lz << 4 | lx, id = section.blocks[j], meta = section.meta[j], i = (lx * 16 + lz) * 256 + s * 16 + ly;
          if (id === entry.orig.blocks[i] && meta === entry.orig.metadata[i]) continue;
          const m = mapBlock(id, meta);
          if (!m?.exact || m.id > 255) { refuse = true; out.unmappedCells++; break; }
          list.push([i, id, meta, m]);
        }
      }
      // Cells the chunk dropped (a populate never removes a section, but air written over blocks reads as 0 here).
      for (let s = 0; s < 16 && !refuse; s++) if (!c.sections[s]) for (let i = s * 16; i < 65536; i += 256) for (let dy = 0; dy < 16; dy++) {
        const cell = i + dy;
        if (entry.orig.blocks[cell] || entry.orig.metadata[cell]) { list.push([cell, 0, 0, { id: 0, meta: 0 }]); }
      }
      if (refuse) break;
      if (list.length) changes.set(key(c.x, c.z), list);
    }
    if (refuse) { out.skipped.unmapped++; continue; }
    const self = cache.get(key(x, z));
    // Cells replaced under an earlier chest, dispenser or spawner drop its record (the block was overwritten, as natively).
    for (const [k, list] of changes) {
      const entry = cache.get(k);
      for (const [i] of list) {
        const old = entry.orig.blocks[i];
        if (old === CHEST_ID || old === DISPENSER_ID || old === 52) {
          const y = i & 255, col = i >> 8;
          dropTile((entry.x - origin.chunkX) * 16 + (col >> 4), y, (entry.z - origin.chunkZ) * 16 + (col & 15));
        }
      }
      out.changedCells += list.length;
      entryChange(entry, list);
      commit(entry, entry === self);
    }
    if (!changes.has(key(x, z))) commit(self, true);
    // Records of the touched stored chunks.
    const inside = (bx, bz) => stored.has(key(bx >> 4, bz >> 4));
    const local = (t) => ({ x: t.x - ox, y: t.y, z: t.z - oz });
    const stackOf = (items) => { const tile = Array(27).fill(null); for (const s of items ?? []) { const m = itemFromOriginal(s.id, s.damage); if (m) tile[s.slot] = makeStack(m.id, s.count, m.damage, s.stored); } return tile; };
    if (runner && dimension === -1) {
      const tiles = structureTileRecords(w, inside);
      for (const t of tiles.chests) if (w.getBlock(t.x, t.y, t.z) === CHEST_ID) out.chests[`${t.x - ox},${t.y},${t.z - oz}`] = { items: stackOf(t.items), facing: t.facing };
      for (const c of w.chunks.values()) for (const t of c.tiles.values()) if (t.kind === "spawner" && inside(t.x, t.z) && w.getBlock(t.x, t.y, t.z) === 52) {
        const l = local(t); out.spawners = out.spawners.filter((q) => !(q.x === l.x && q.y === l.y && q.z === l.z)); out.spawners.push({ ...l, EntityId: t.name });
      }
    } else if (!runner) {
      const tiles = structureTileRecords(w, inside);
      for (const t of tiles.chests) if (w.getBlock(t.x, t.y, t.z) === CHEST_ID) out.chests[`${t.x - ox},${t.y},${t.z - oz}`] = { items: stackOf(t.items), facing: t.facing };
      for (const t of tiles.dispensers) if (w.getBlock(t.x, t.y, t.z) === DISPENSER_ID) {
        const items = Array(9).fill(null);
        for (const s of t.items ?? []) { const m = itemFromOriginal(s.id, s.damage); if (m && s.slot < 9) items[s.slot] = makeStack(m.id, s.count, m.damage, s.stored); }
        out.dispensers[`${t.x - ox},${t.y},${t.z - oz}`] = { items, facing: t.facing };
      }
      for (const t of tiles.pots) if (inside(t.x, t.z)) out.pots.push({ ...t, x: t.x - ox, z: t.z - oz });
      for (const t of w.liveSpawners()) if (inside(t.x, t.z)) { const l = local(t); out.spawners = out.spawners.filter((s) => !(s.x === l.x && s.y === l.y && s.z === l.z)); out.spawners.push({ ...l, EntityId: t.name }); }
      for (const e of w.carts) {
        if (!inside(Math.floor(e.x), Math.floor(e.z))) continue;
        out.carts.push({ x: e.x - ox, y: e.y, z: e.z - oz, type: 1, onGround: false, items: e.slots.flatMap((s, slot) => (s ? [{ slot, id: s[0], count: s[1], damage: s[2], ...(s[3]?.length ? { stored: s[3].map(([id, lvl]) => ({ id, lvl })) } : {}) }] : [])) });
      }
    }
    const mobs = runner ? pass.entities : w.animals;
    for (const e of mobs) {
      if (!inside(Math.floor(e.x), Math.floor(e.z))) continue;
      const rec = entityRecord(e, ox, oz);
      if (rec) { out.entities.push(rec); out.kept[e.type === "Villager" ? "villagers" : "animals"]++; }
      else out.dropped[e.type === "Villager" ? "villagers" : "animals"]++;
    }
    for (const [px, py, pz, id, delay] of runner ? pass.pending : w.pending) {
      if (!inside(px, pz)) continue;
      const bid = w.getBlock(px, py, pz), m = mapBlock(bid, w.getBlockMetadata(px, py, pz)), list = TICK_LISTS[id];
      // A fluid tick stays on whatever fluid the cell holds now (BlockLiquid.onBlockAdded turns a closed pocket static); the others need their block.
      if (list && m?.exact && (list === "fluidTicks" ? LIQUIDS.has(bid) : bid === id)) out[list].push({ x: px - ox, y: py, z: pz - oz, block: m.id, delay });
      else { out.dropped.ticks++; (out.droppedTickIds[id] = (out.droppedTickIds[id] ?? 0) + 1); }
    }
    out.populated++; out.calls++; (out.order ??= []).push([x, z]);
    trim(new Set(needed.map(([a, b]) => key(a, b))));
    if (pending.length >= BATCH) await flush();
    if (index % 4 === 3) { onProgress({ phase: "populate", done: index + 1, total: plan.length }); await new Promise((r) => setTimeout(r, 0)); }
  }
  await flush();
  onProgress({ phase: "populate", done: plan.length, total: plan.length });
  out.ms = Date.now() - started;
  return out;
}

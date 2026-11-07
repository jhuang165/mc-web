// Whole Java save import (remaining-gaps Priority 5, batch 15). save-folder-import.js converts one 8x8-chunk area into
// edits over the generated terrain; this module streams EVERY chunk of region/*.mca, DIM-1/region and DIM1/region instead:
//   - one region file is held at a time; each chunk goes through the existing converter (importJavaRegionArea: blocks through
//     the block registry, tile entities, containers, entities, items) as a 1x1 area on a ColumnSink, a stand-in world that
//     records the converted cells rather than generating terrain;
//   - the converted cells become a stored full column (whole-save-columns.js) written to the BASES store in small batches,
//     keyed by the world's local chunk coordinates (Overworld: native minus the generator origin; Nether and End: native);
//   - the runtime state (chests, mobs, drops, signs, carts, ...) of all chunks is merged into the world record, which the
//     existing column runtime store (chunk-runtime.js) splits per column when the record is first saved;
//   - chunks missing from the save stay absent from BASES and generate from the seed as usual; imported columns are marked
//     claimed (populatedColumns) so generated chests/animals/structure records are not handed over a second time.
// The player, level.dat, stats and data/*.dat (villages, maps, scoreboard, structure starts) come from one more converter call
// with no regions (the villages of the whole world are kept, not only those inside an area).
import { REGION_LIMIT } from "./region-inspection.js";
import { importJavaRegionArea } from "./region-import.js";
import { relinkMobs } from "./owner-links.js";
import { readLevelDat, readPlayerDat, levelGenerator } from "./level-dat.js";
import { indexSave, bytesOf, inDir, pickPlayer, pickStats } from "./save-folder-import.js";
import { readRegion, writeRegion } from "./region-file.js";
import { World } from "./world.js";
import { DIM_KEYS, TILE_KEYS, viewId } from "./dimension-live.js";
import { encodeBaseColumn } from "./whole-save-columns.js";

const SMALL_LIMIT = 16 << 20, BATCH = 16;
export const DIMENSIONS = [{ dimension: 0, dir: "region" }, { dimension: -1, dir: "DIM-1/region" }, { dimension: 1, dir: "DIM1/region" }];

/** The converter's world stand-in: absolute cells (block | meta << 8) over air, per local 16x16x256 column. */
export class ColumnSink {
  constructor({ originX = 0, originZ = 0 } = {}) {
    this.originX = originX; this.originZ = originZ; this.height = 256;
    this.edits = []; this.cols = new Map(); this.decoded = null;
  }
  streamAround() { return null; }
  biomeAt() { return { id: -1 }; }
  solid() { return false; }
  get(x, y, z) { const c = this.cols.get(`${x >> 4},${z >> 4}`); return c ? c[((x & 15) * 16 + (z & 15)) * 256 + y] & 255 : 0; }
  getMeta(x, y, z) { const c = this.cols.get(`${x >> 4},${z >> 4}`); return c ? c[((x & 15) * 16 + (z & 15)) * 256 + y] >> 8 : 0; }
  set(x, y, z, block, track, meta = 0) {
    const key = `${x >> 4},${z >> 4}`;
    let c = this.cols.get(key);
    if (!c) this.cols.set(key, c = new Uint16Array(65536));
    c[((x & 15) * 16 + (z & 15)) * 256 + y] = block | (meta & 15) << 8;
    return true;
  }
  chunkDecoded(chunk) { this.decoded = { biomes: chunk.biomes, terrainPopulated: chunk.isTerrainPopulated, lightPopulated: chunk.isLightPopulated }; }
  /** The cells of local column (x, z) (air when nothing was written) and the flags of the chunk just decoded; resets the sink. */
  take(x, z) {
    const cells = this.cols.get(`${x},${z}`) ?? new Uint16Array(65536), decoded = this.decoded;
    this.cols.clear(); this.decoded = null;
    return { cells, decoded };
  }
}

// Region files of the save by dimension: [{dimension, path, regionX, regionZ}] sorted for a stable import order.
export function regionFiles(files) {
  const out = [];
  for (const { dimension, dir } of DIMENSIONS)
    for (const [path] of inDir(files, dir, ".mca")) {
      const m = /r\.(-?\d+)\.(-?\d+)\.mca$/.exec(path);
      if (m) out.push({ dimension, path, regionX: Number(m[1]), regionZ: Number(m[2]) });
    }
  return out.sort((a, b) => a.dimension - b.dimension || a.regionX - b.regionX || a.regionZ - b.regionZ);
}

const tally = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);
const LIST_SKIP = new Set(["populatedColumns", "containerScope", "editSequence", "dragonSpawned"]);
const CELL_BIT = (x, z) => 1n << BigInt((x & 7) * 8 + (z & 7));
// Merge one converter record's runtime state into an accumulator {state, tiles, cells: Map cell key -> BigInt mask}.
// Vehicle ids (boats, carts) made for ridden chains start at 1000000 in every converter call: remap them to a save-wide counter
// and rewrite the "boat-<id>" / "cart-<id>" riding links of the mobs that sit in them.
const RIDDEN_VEHICLE = 1000000;
function vehicleIdMap(acc, state) {
  const map = new Map();
  const take = (kind, list) => { for (const v of list ?? []) if (Number.isInteger(v?.id) && v.id >= RIDDEN_VEHICLE) map.set(`${kind}-${v.id}`, acc.nextVehicle ??= RIDDEN_VEHICLE), acc.nextVehicle++; };
  take("boat", state?.boats); take("cart", state?.minecarts?.carts);
  return map;
}
function mergeRuntime(acc, state, tiles, seq) {
  const vehicles = vehicleIdMap(acc, state);
  const vehicleOf = (v, kind) => { if (Number.isInteger(v?.id) && vehicles.has(`${kind}-${v.id}`)) v.id = Number(vehicles.get(`${kind}-${v.id}`)); };
  for (const [name, value] of Object.entries(state ?? {})) {
    if (name === "populatedColumns") {
      for (const [k, hex] of Object.entries(value.cells)) acc.cells.set(k, (acc.cells.get(k) ?? 0n) | BigInt(`0x${hex}`));
    } else if (LIST_SKIP.has(name)) continue;
    else if (name === "minecarts") {
      const m = (acc.state.minecarts ??= { version: 1, carts: [] });
      for (const c of value.carts ?? []) { vehicleOf(c, "cart"); m.carts.push(c); }
    } else if (name === "eyes" || name === "rockets") {
      const m = (acc.state[name] ??= { [name]: [] });
      for (const e of value[name] ?? []) m[name].push(e);
    } else if (Array.isArray(value)) {
      const list = (acc.state[name] ??= []);
      for (const e of value) {
        // Rider pairs are linked by opaque ids that restart in every converter call: keep them unique across the save.
        if (name === "entities" && typeof e?.id === "string" && /^mob-/.test(e.id)) e.id = `${e.id}.${seq}`;
        if (name === "entities" && typeof e?.riding === "string" && /^mob-/.test(e.riding)) e.riding = `${e.riding}.${seq}`;
        else if (name === "entities" && typeof e?.riding === "string" && vehicles.has(e.riding)) e.riding = `${e.riding.split("-")[0]}-${vehicles.get(e.riding)}`;
        if (name === "boats") vehicleOf(e, "boat");
        list.push(e);
      }
    }
  }
  for (const key of TILE_KEYS) if (tiles?.[key]) Object.assign((acc.tiles[key] ??= {}), tiles[key]);
}
const cellsRecord = (cells) => ({ version: 1, cells: Object.fromEntries([...cells].map(([k, v]) => [k, v.toString(16)])) });

function mergeReport(total, rep) {
  const sum = (obj, keys) => { for (const k of keys) obj[k] = (obj[k] ?? 0) + (rep.blocks[k] ?? 0); };
  sum(total.blocks, ["sourceCells", "exact", "approximated", "omitted"]);
  for (const [name, source] of [["unsupported", rep.blocks.unsupported], ["approximations", rep.blocks.approximations]])
    for (const e of source) tally(total.maps[name], `${e.id}:${e.meta}`, e.cells);
  for (const [map, list] of [[total.maps.tileLost, rep.tileEntities.lost], [total.maps.itemLost, rep.items.lost], [total.maps.entityLost, rep.entities.lost]])
    for (const e of list) tally(map, e.id ?? e.key ?? Object.values(e)[0], e.count);
  for (const [map, obj] of [[total.maps.tileConverted, rep.tileEntities.converted], [total.maps.entityConverted, rep.entities.converted]])
    for (const [k, n] of Object.entries(obj)) tally(map, k, n);
  total.items.converted += rep.items.converted; total.items.tagsStripped += rep.items.tagsStripped; total.items.clamped += rep.items.clamped;
  total.tileEntities.total += rep.tileEntities.total; total.entities.total += rep.entities.total;
  total.scheduledTicks += rep.scheduledTicks;
}
const sorted = (map, name = "id") => [...map].sort(([a], [b]) => String(a).localeCompare(String(b), "en", { numeric: true })).map(([key, count]) => ({ [name]: key, count }));

/**
 * Convert a whole Java save folder. entries as in save-folder-import.js indexSave.
 * options: worldId (required: BASES key of the new world), writeBases(records) (world-storage.js writeBaseColumns),
 * onProgress({phase, file, fileIndex, fileCount, chunks, skipped, dimension}), signal (AbortSignal), name.
 * Returns {record, report}; record is a Blockworld export object (format "blockworld") with `dimensions` and no edits; its
 * stored full columns are already written. The caller passes it to the Import pipeline with {id: worldId, wholeSave}.
 */
export async function importWholeSave(entries, options = {}) {
  const { worldId, writeBases, onProgress = () => {}, signal } = options;
  if (!worldId || typeof writeBases !== "function") throw new TypeError("importWholeSave needs worldId and writeBases");
  const aborted = () => { if (signal?.aborted) throw new DOMException("Import cancelled", "AbortError"); };
  const { files, folder } = indexSave(entries);
  const level = await readLevelDat(await bytesOf(files.get("level.dat"), SMALL_LIMIT));
  const chosen = pickPlayer(files);
  const levelOpts = { level };
  if (!level.player && chosen) levelOpts.player = await readPlayerDat(await bytesOf(chosen.entry, SMALL_LIMIT));
  const stats = pickStats(files, chosen?.entry);
  if (stats) levelOpts.stats = new TextDecoder().decode(await bytesOf(stats, SMALL_LIMIT));
  const structureData = [];
  for (const [path, entry] of inDir(files, "data", ".dat")) structureData.push({ filename: path, bytes: await bytesOf(entry, SMALL_LIMIT) });

  // The generator origin of the seed: local chunk = native chunk - origin (region-import.js level frame).
  const gen = levelGenerator(level);
  onProgress({ phase: "origin" });
  const origin = (() => { const w = new World(gen.seed, "javaStreamed", gen.generationVersion, gen.worldType, gen.generatorOptions); return { chunkX: w.originX >> 4, chunkZ: w.originZ >> 4 }; })();
  const sinkFor = (dimension) => new ColumnSink(dimension ? {} : { originX: origin.chunkX * 16, originZ: origin.chunkZ * 16 });

  // Player, level fields and world-wide data: the converter with no regions and the whole-world villages.
  aborted();
  const spawnChunk = { chunkX: Math.floor(level.spawn[0] / 16), chunkZ: Math.floor(level.spawn[2] / 16), width: 1, depth: 1 };
  const meta = await importJavaRegionArea([], { ...levelOpts, area: spawnChunk, sink: sinkFor(0), wholeSave: true, structureData, ...(options.name ? { name: options.name } : {}) });

  const total = {
    blocks: { sourceCells: 0, exact: 0, approximated: 0, omitted: 0 },
    items: { converted: 0, tagsStripped: 0, clamped: 0 }, tileEntities: { total: 0 }, entities: { total: 0 }, scheduledTicks: 0,
    maps: { unsupported: new Map(), approximations: new Map(), tileLost: new Map(), itemLost: new Map(), entityLost: new Map(), tileConverted: new Map(), entityConverted: new Map() },
  };
  const acc = new Map(DIMENSIONS.map(({ dimension }) => [dimension, { state: {}, tiles: {}, cells: new Map() }]));
  const counts = { 0: 0, "-1": 0, 1: 0 }, skipped = [];
  const perChunkLevel = { ...level, player: null };
  const list = regionFiles(files);
  let pending = [], seq = 0, chunksDone = 0;
  const flush = async () => { if (pending.length) { const batch = pending; pending = []; await writeBases(batch); } };
  try {
    for (const [fileIndex, file] of list.entries()) {
      aborted();
      const bytes = await bytesOf(files.get(file.path), REGION_LIMIT);
      let entriesBySlot;
      try { entriesBySlot = readRegion(bytes); }
      catch (error) { skipped.push({ file: file.path, reason: error.message }); continue; }
      const id = file.dimension ? viewId(worldId, file.dimension) : worldId, sink = sinkFor(file.dimension), filename = `r.${file.regionX}.${file.regionZ}.mca`;
      for (const [slot, entry] of entriesBySlot) {
        aborted();
        const cx = file.regionX * 32 + (slot & 31), cz = file.regionZ * 32 + (slot >> 5);
        try {
          // A one-chunk region file keeps the converter from copying the whole region for every chunk.
          const mini = writeRegion([entry]), area = { chunkX: cx, chunkZ: cz, width: 1, depth: 1 };
          const { record, report } = await importJavaRegionArea([{ filename, bytes: mini }], file.dimension
            ? { seed: level.seed, dimension: file.dimension, area, sink }
            : { level: perChunkLevel, area, sink });
          const lx = file.dimension ? cx : cx - origin.chunkX, lz = file.dimension ? cz : cz - origin.chunkZ;
          const { cells, decoded } = sink.take(lx, lz);
          pending.push(encodeBaseColumn(id, lx, lz, cells, decoded ?? {}));
          const blob = file.dimension ? record.dimensions?.[file.dimension] : null;
          mergeRuntime(acc.get(file.dimension), blob ? blob.state : pickState(record), blob ? blob.tiles : record.player, ++seq);
          mergeReport(total, report);
          counts[file.dimension]++;
        } catch (error) {
          sink.take(0, 0);
          if (error?.name === "AbortError") throw error;
          if (skipped.length < 100) skipped.push({ file: file.path, chunk: [cx, cz], reason: error.message });
        }
        chunksDone++;
        if (pending.length >= BATCH) await flush();
        if (chunksDone % 4 === 0) { onProgress({ phase: "chunks", file: filename, dimension: file.dimension, fileIndex, fileCount: list.length, chunks: chunksDone, skipped: skipped.length }); await new Promise((r) => setTimeout(r, 0)); }
      }
      await flush();
      onProgress({ phase: "chunks", file: filename, dimension: file.dimension, fileIndex: fileIndex + 1, fileCount: list.length, chunks: chunksDone, skipped: skipped.length });
    }
    await flush();
  } catch (error) { pending = []; throw error; }

  // Assemble: the world record from the metadata call, the merged runtime state of the overworld chunks and a blob per dimension.
  const record = { ...meta.record };
  const over = acc.get(0);
  record.player = { ...record.player };
  for (const key of TILE_KEYS) if (over.tiles[key]) record.player[key] = { ...record.player[key], ...over.tiles[key] };
  for (const [name, value] of Object.entries(over.state)) record[name] = name === "entities" || Array.isArray(value) ? [...(record[name] ?? []), ...value] : value;
  record.populatedColumns = cellsRecord(over.cells);
  if (record.playerUuid) relinkMobs(record.entities, record.playerUuid); // owner and leash links of the merged chunks (owner-links.js)
  record.edits = [];
  for (const { dimension } of DIMENSIONS.slice(1)) {
    const a = acc.get(dimension);
    if (!counts[dimension]) continue;
    const state = { ...a.state, populatedColumns: cellsRecord(a.cells) };
    if (dimension === 1) state.dragonSpawned = true;
    if (record.playerUuid) relinkMobs(state.entities, record.playerUuid);
    (record.dimensions ??= {})[dimension] = { state, tiles: Object.fromEntries(TILE_KEYS.filter((k) => a.tiles[k]).map((k) => [k, a.tiles[k]])), edits: [] };
  }
  record.wholeSave = { version: 1, columns: counts };
  const report = meta.report;
  report.save = {
    folder, mode: "whole save", regionFilesRead: list.map((f) => f.path), columns: counts, skipped,
    playerFile: !level.player && chosen ? { name: chosen.entry.path.split("/").pop(), of: chosen.count } : null,
    statsFile: stats ? stats.path.split("/").pop() : null, dataFiles: structureData.map((f) => f.filename),
    notImported: [...(skipped.length ? [`${skipped.length} chunk(s) or region file(s) could not be read and regenerate from the seed`] : []),
      "SkyLight/BlockLight, heightmaps and per-chunk InhabitedTime/LastUpdate (the browser relights); imported chunks are never re-populated, including chunks the save marked TerrainPopulated=false"],
  };
  report.chunks = { converted: counts[0] + counts[-1] + counts[1], overworld: counts[0], nether: counts[-1], end: counts[1], skipped: skipped.length };
  report.blocks = { ...total.blocks, unsupported: sorted(total.maps.unsupported, "key"), approximations: sorted(total.maps.approximations, "key") };
  report.tileEntities = { ...total.tileEntities, converted: Object.fromEntries(total.maps.tileConverted), lost: sorted(total.maps.tileLost) };
  report.items = { ...total.items, lost: sorted(total.maps.itemLost) };
  report.entities = { ...total.entities, converted: Object.fromEntries(total.maps.entityConverted), lost: sorted(total.maps.entityLost) };
  report.scheduledTicks = total.scheduledTicks;
  report.edits = 0;
  return { record, report };
}
const pickState = (rec) => Object.fromEntries(DIM_KEYS.filter((k) => Object.hasOwn(rec, k)).map((k) => [k, rec[k]]));

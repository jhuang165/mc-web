// Round-trip a save folder (tools/make-synthetic-save.mjs) through whole-save import (the browser path, fake IndexedDB) and the
// Java export, then report per dimension what survived: block cells (original id + meta), tile entities and entities by id,
// TerrainPopulated flags. Chunks the import populated legitimately differ from the input; they are listed separately.
//   node tools/roundtrip-synthetic-save.mjs SAVE_DIR [--report out.json]
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fakeIndexedDB } from '../src/fake-indexeddb.js';
globalThis.indexedDB = fakeIndexedDB();
const dir = process.argv[2], reportPath = process.argv[3] === '--report' ? process.argv[4] : null;
if (!dir) { console.error('Usage: node tools/roundtrip-synthetic-save.mjs SAVE_DIR [--report out.json]'); process.exit(2); }
const { importWholeSave } = await import('../src/whole-save-import.js');
const { writeBaseColumns, readBaseColumns } = await import('../src/world-storage.js');
const { exportJavaSave } = await import('../src/region-export.js');
const { readRegion, decodeRegionChunk, regionSlot } = await import('../src/region-file.js');
const { chunkFromNbt } = await import('../src/chunk-nbt.js');
const { Survival } = await import('../src/survival.js');

const walk = async (rel = '') => {
  const out = [];
  for (const name of await readdir(join(dir, rel))) {
    const path = rel ? `${rel}/${name}` : name, info = await stat(join(dir, path));
    if (info.isDirectory()) out.push(...await walk(path));
    else out.push({ path: `save/${path}`, size: info.size, modified: info.mtimeMs, read: async () => new Uint8Array(await readFile(join(dir, path))) });
  }
  return out;
};
const entries = await walk();
const input = new Map(entries.map((e) => [e.path.slice(5), e]));
const chunksOf = async (files, get) => {
  const out = new Map();
  for (const [path, bytes] of files) {
    const m = /^((?:DIM-?1\/)?)region\/r\.(-?\d+)\.(-?\d+)\.mca$/.exec(path);
    if (!m) continue;
    const region = readRegion(await bytes());
    for (let slot = 0; slot < 1024; slot++) {
      const entry = region.get(slot);
      if (!entry) continue;
      const c = chunkFromNbt(await decodeRegionChunk(entry));
      out.set(`${m[1]}|${c.chunk.x}|${c.chunk.z}`, c);
    }
  }
  return out;
};
const tally = (c) => {
  const t = {}, e = {};
  for (const x of c.tileEntities) t[x.get('id').value] = (t[x.get('id').value] ?? 0) + 1;
  for (const x of c.entities) e[x.get('id').value] = (e[x.get('id').value] ?? 0) + 1;
  return { t, e };
};
const kinds = new Map();
const cellDiff = (a, b, track) => {
  let same = 0, differ = 0;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < 256; y++) {
    if (a.chunk.getBlock(x, y, z) === b.chunk.getBlock(x, y, z) && a.chunk.getMeta(x, y, z) === b.chunk.getMeta(x, y, z)) same++;
    else {
      differ++;
      if (track) { const k = `${globalThis.__dim}: ${a.chunk.getBlock(x, y, z)}:${a.chunk.getMeta(x, y, z)} -> ${b.chunk.getBlock(x, y, z)}:${b.chunk.getMeta(x, y, z)}`; kinds.set(k, (kinds.get(k) ?? 0) + 1); }
    }
  }
  return { same, differ };
};
const t0 = Date.now(), written = [];
const imported = await importWholeSave(entries, { worldId: 'rt', readBases: readBaseColumns, writeBases: async (r) => { written.push(r.length); await writeBaseColumns(r); } });
const tImport = Date.now() - t0;
const player = { ...new Survival({}, 'survival').serialize(), ...imported.record.player };
const exported = await exportJavaSave({ ...imported.record, id: 'rt', mode: 'survival', player, edits: [] }, { readBases: readBaseColumns, maxChunks: 16384 });
const before = await chunksOf(new Map([...input].filter(([p]) => p.endsWith('.mca')).map(([p, e]) => [p, e.read])), true);
const after = await chunksOf(new Map([...exported.files].filter(([p]) => p.endsWith('.mca')).map(([p, b]) => [p, async () => b])), true);

const rows = {};
for (const [key, a] of before) {
  const dim = key.split('|')[0] || 'overworld', row = (rows[dim] ??= { chunks: 0, missing: 0, identical: 0, changedChunks: 0, changedCells: 0, populatedByImport: 0, tilesIn: {}, tilesOut: {}, entsIn: {}, entsOut: {}, flagLost: 0 });
  row.chunks++;
  const b = after.get(key);
  if (!b) { row.missing++; continue; }
  globalThis.__dim = dim;
  const d = cellDiff(a, b, a.chunk.isTerrainPopulated);
  if (!a.chunk.isTerrainPopulated && b.chunk.isTerrainPopulated) row.populatedByImport++;
  else if (a.chunk.isTerrainPopulated && !b.chunk.isTerrainPopulated) row.flagLost++;
  if (d.differ) { row.changedChunks++; row.changedCells += d.differ; } else row.identical++;
  for (const [src, to] of [[tally(a), [row.tilesIn, row.entsIn]], [tally(b), [row.tilesOut, row.entsOut]]]) {
    for (const [k, n] of Object.entries(src.t)) to[0][k] = (to[0][k] ?? 0) + n;
    for (const [k, n] of Object.entries(src.e)) to[1][k] = (to[1][k] ?? 0) + n;
  }
}
// TileTicks (batch 29): the multiset of {i, x, y, z, t, p} per dimension before and after.
const tickKey = (m) => ['i', 'x', 'y', 'z', 't', 'p'].map((k) => m.get(k).value).join(',');
const tickRows = {};
for (const [which, set] of [['in', before], ['out', after]]) for (const [key, c] of set) {
  const dim = key.split('|')[0] || 'overworld', r = (tickRows[dim] ??= { in: new Map(), out: new Map() });
  for (const m of c.tileTicks ?? []) r[which].set(tickKey(m), (r[which].get(tickKey(m)) ?? 0) + 1);
}
const tickReport = Object.fromEntries(Object.entries(tickRows).map(([dim, r]) => {
  const lost = [], added = [];
  for (const [k, n] of r.in) if ((r.out.get(k) ?? 0) < n) lost.push(k);
  for (const [k, n] of r.out) if ((r.in.get(k) ?? 0) < n) added.push(k);
  return [dim, { distinctIn: r.in.size, distinctOut: r.out.size, identical: r.in.size - lost.length, lost: lost.slice(0, 12), lostCount: lost.length, added: added.slice(0, 12), addedCount: added.length }];
}));
const topKinds = [...kinds].sort((p, q) => q[1] - p[1]).filter(([k], i) => i < 20 || !k.startsWith('overworld')).map(([k, n]) => `${k} x${n}`);
const report = { tileTicks: tickReport, importTicks: imported.report.ticks, changedCellKinds: topKinds, importMs: tImport, batches: written.length, population: imported.report.population, notImported: imported.report.notImported, levelFiles: [...exported.files.keys()].filter((p) => !p.endsWith('.mca')), dimensions: rows, exportReport: exported.report };
if (reportPath) await writeFile(reportPath, JSON.stringify(report, (k, v) => (typeof v === 'bigint' ? String(v) : v), 2));
console.log(JSON.stringify(report, (k, v) => (typeof v === 'bigint' ? String(v) : v), 2).slice(0, 6000));

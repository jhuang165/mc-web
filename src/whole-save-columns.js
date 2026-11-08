// Stored full columns (whole Java save import, remaining-gaps Priority 5). A streamed world normally keeps only the player's
// edits per column (world-storage.js CHUNKS) and regenerates the rest from the seed. A column imported from a Java save has
// no generator to diff against, so its cells are stored whole in the BASES store, keyed [worldId, x, z] (worldId is
// `${id}` or `${id}~${dimension}`, x/z the world's local chunk coordinates, native minus the generator origin for the
// Overworld). The record takes precedence over generation when the column is hydrated (World.terrainFor); the player's later
// edits stay in CHUNKS on top of it, exactly as for a generated column.
//
// Cells use the generator's layout, index (lx * 16 + lz) * 256 + y, block = internal id (one byte), meta = 4 bits. Only the
// sections that hold a block are stored: block bytes (4096) and metadata nibbles (2048) per section, indexed
// (lx * 16 + lz) * 16 + (y & 15). `biomes` are the saved Biomes bytes (255 = unset) and the two flags are the saved
// TerrainPopulated / LightPopulated, kept so an export can write them back (a chunk the save never populated stays
// unpopulated for Java; the browser runtime never populates an imported column, see public/research/region-import.md).
export const BASE_VERSION = 1, COLUMN_CELLS = 65536;

/** cells: Uint16Array(65536), block | meta << 8 at (lx * 16 + lz) * 256 + y. */
export function encodeBaseColumn(world, x, z, cells, { biomes = null, terrainPopulated = true, lightPopulated = false, overlay = null } = {}) {
  const sections = [];
  for (let s = 0; s < 16; s++) {
    let blocks = null, meta = null;
    for (let col = 0; col < 256; col++) for (let dy = 0; dy < 16; dy++) {
      const value = cells[col * 256 + s * 16 + dy];
      if (!value) continue;
      if (!blocks) { blocks = new Uint8Array(4096); meta = new Uint8Array(2048); }
      const i = col * 16 + dy;
      blocks[i] = value & 255;
      if (value >> 8) meta[i >> 1] |= (value >> 8 & 15) << ((i & 1) * 4);
    }
    if (blocks) sections.push({ s, blocks, meta });
  }
  const record = { world, x, z, v: BASE_VERSION, sections, biomes: biomes ? Uint8Array.from(biomes, (b) => b & 255) : null, terrainPopulated: !!terrainPopulated, lightPopulated: !!lightPopulated };
  const orig = overlayToList(overlay);
  if (orig.length) record.orig = orig;
  return record;
}

// Original-state overlay (batch 28): the cell format keeps one internal id and 4 bits of meta, which cannot tell a level-0 flowing fluid
// from a still one nor carry the facing of a chest. `orig` is an OPTIONAL sparse list [index, id << 4 | meta, ...] (index as in `cells`,
// sorted) of the original-id state of exactly the cells whose original differs from what the registry implies for the stored cell
// (toOriginal(id, meta, {flowing: meta !== 0})). Records without it (every column stored before batch 28) read as before.
export function overlayToList(overlay) {
  if (!overlay?.size) return [];
  const out = [];
  for (const i of [...overlay.keys()].sort((a, b) => a - b)) out.push(i, overlay.get(i));
  return out;
}
export function overlayFromList(list) {
  const map = new Map();
  if (!Array.isArray(list) && !ArrayBuffer.isView(list)) return map;
  if (list.length % 2) throw new Error('Saved imported column is damaged');
  for (let k = 0; k < list.length; k += 2) {
    const i = list[k], v = list[k + 1];
    if (!Number.isInteger(i) || i < 0 || i >= COLUMN_CELLS || !Number.isInteger(v) || v < 0 || v > 0xffff) throw new Error('Saved imported column is damaged');
    map.set(i, v);
  }
  return map;
}

/** The {blocks, metadata} the generator contract expects (world.js streamAround), plus the saved biome bytes and flags. */
export function decodeBaseColumn(record, blockCount = 256) {
  if (record?.v !== BASE_VERSION || !Array.isArray(record.sections)) throw new Error('Saved imported column is damaged');
  const blocks = new Uint8Array(COLUMN_CELLS), metadata = new Uint8Array(COLUMN_CELLS), seen = new Set();
  for (const { s, blocks: b, meta: m } of record.sections) {
    if (!Number.isInteger(s) || s < 0 || s > 15 || seen.has(s) || b?.length !== 4096 || m?.length !== 2048) throw new Error('Saved imported column is damaged');
    seen.add(s);
    for (let col = 0; col < 256; col++) for (let dy = 0; dy < 16; dy++) {
      const i = col * 16 + dy, id = b[i];
      if (id >= blockCount) throw new Error('Saved imported column is damaged');
      blocks[col * 256 + s * 16 + dy] = id;
      metadata[col * 256 + s * 16 + dy] = (m[i >> 1] >> ((i & 1) * 4)) & 15;
    }
  }
  return { blocks, metadata, overlay: overlayFromList(record.orig), biomes: record.biomes ?? null, terrainPopulated: record.terrainPopulated !== false, lightPopulated: !!record.lightPopulated };
}

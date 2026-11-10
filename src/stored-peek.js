// Stored-column index of an imported whole save (whole-save-import.js): what the Teleporter's portal search and /spreadplayers
// read about columns that are not resident. Built once per world and dimension by scanning the stored sections (no full decode):
//   tops    "cx,cz" -> Uint16Array(256), per (lx*16+lz) the Java top-block+1 over y >= 1 (CommandSpreadPlayers; 0 = empty column)
//   portals "cx,cz" -> [[x,z,[y...]]...] columns holding a marker block (the nether portal id)
//   kept    "cx,cz" -> decoded {blocks, metadata} of the marker columns only (at most KEEP_LIMIT, so the search can read them)
// Cost: 512 bytes per stored column in memory, one pass over the stored sections in time (about 0.1 ms per column in Node), plus
// a full decode (128 KiB) for each of up to 256 columns that hold a portal.
import { decodeBaseColumn } from "./whole-save-columns.js";

export const KEEP_LIMIT = 256;
const BATCH = 64;

export class StoredIndex {
  constructor(marker = 0) { this.marker = marker; this.tops = new Map(); this.portals = new Map(); this.kept = new Map(); this.omitted = 0; this.ready = false; }
  has(cx, cz) { return this.tops.has(`${cx},${cz}`); }
  // Top block + 1 of a stored column, 257 over an empty column, undefined when the column is not stored.
  topY(x, z) {
    const t = this.tops.get(`${x >> 4},${z >> 4}`);
    if (!t) return undefined;
    return t[(x & 15) * 16 + (z & 15)] || 257;
  }
  // A kept marker column's decoded terrain, or null.
  column(cx, cz) { return this.kept.get(`${cx},${cz}`) ?? null; }
  portalColumns(x0, x1, z0, z1) {
    const out = [];
    for (const list of this.portals.values()) for (const [x, z, ys] of list) if (x >= x0 && x <= x1 && z >= z0 && z <= z1) out.push([x, z, ys]);
    return out;
  }
  add(record, marker, blockCount) {
    const key = `${record.x},${record.z}`, top = new Uint16Array(256), found = [];
    for (const { s, blocks } of record.sections) {
      for (let col = 0; col < 256; col++) for (let dy = 0; dy < 16; dy++) {
        const id = blocks[col * 16 + dy], y = s * 16 + dy;
        if (!id) continue;
        if (y >= 1 && y + 1 > top[col]) top[col] = y + 1;
        if (id === marker) found.push([col, y]);
      }
    }
    this.tops.set(key, top);
    if (!found.length) return;
    const seen = new Map(), cols = [];
    for (const [col, y] of found) {
      let c = seen.get(col);
      if (!c) { c = [record.x * 16 + (col >> 4), record.z * 16 + (col & 15), []]; seen.set(col, c); cols.push(c); }
      c[2].push(y);
    }
    this.portals.set(key, cols);
    if (this.kept.size < KEEP_LIMIT) this.kept.set(key, decodeBaseColumn(record, blockCount)); else this.omitted++;
  }
}

/** list() -> [[cx,cz]...], read(columns) -> stored records (null where missing). Resolves with the finished index. */
export async function buildStoredIndex({ list, read, marker, blockCount = 256, signal = null }) {
  const index = new StoredIndex(marker), coords = await list();
  for (let i = 0; i < coords.length; i += BATCH) {
    if (signal?.aborted) break;
    for (const record of await read(coords.slice(i, i + BATCH))) if (record) index.add(record, marker, blockCount);
  }
  index.ready = !signal?.aborted;
  return index;
}

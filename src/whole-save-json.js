// Blockworld JSON round trip of stored full columns (the BASES store of a whole Java save import, whole-save-columns.js).
// The browser backup used to omit them, so a re-imported whole-save world kept its runtime state but regenerated the
// terrain from the seed. The JSON carries them under `bases`, keyed by dimension ("0", "-1", "1"), as
//   { x, z, v, t: terrainPopulated, l: lightPopulated, biomes: base64 | null, sections: [[s, base64 blocks, base64 meta], ...] }
// with x/z the world's local chunk coordinates (as stored). Base64 inflates 4/3 and a full column is about 130 KB, and
// the file importer accepts at most 128 MiB of text, so the export holds at most BASES_JSON_LIMIT characters of columns;
// a larger world keeps its edits and runtime state and records `basesOmitted` (columns that did not fit) so the import
// can say that the terrain regenerates from the seed instead of pretending the columns are there.
import { BASE_VERSION, decodeBaseColumn } from "./whole-save-columns.js";

export const BASES_JSON_LIMIT = 96 * 1024 * 1024, READ_BATCH = 64;
const DIMENSIONS = [0, -1, 1];

function toBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export function baseToJson(record) {
  return {
    x: record.x, z: record.z, v: record.v, t: !!record.terrainPopulated, l: !!record.lightPopulated,
    biomes: record.biomes ? toBase64(Uint8Array.from(record.biomes)) : null,
    sections: record.sections.map((s) => [s.s, toBase64(s.blocks), toBase64(s.meta)]),
    ...(record.orig?.length ? { o: Array.from(record.orig) } : {}),
  };
}
// Validated like a stored column (decodeBaseColumn throws on a damaged one); `world` is the new owner key.
export function baseFromJson(world, json) {
  if (!json || !Number.isInteger(json.x) || !Number.isInteger(json.z) || !Array.isArray(json.sections) || json.v !== BASE_VERSION) throw new Error("Saved imported column is damaged");
  const record = {
    world, x: json.x, z: json.z, v: BASE_VERSION,
    sections: json.sections.map((s) => ({ s: s?.[0], blocks: fromBase64(String(s?.[1])), meta: fromBase64(String(s?.[2])) })),
    biomes: json.biomes ? fromBase64(json.biomes) : null, terrainPopulated: json.t !== false, lightPopulated: !!json.l,
    ...(json.o === undefined ? {} : { orig: Array.from(json.o) }),
  };
  decodeBaseColumn(record);
  return record;
}

/**
 * Stored columns of a world and its Nether/End views as JSON. list(worldKey) -> [[x,z]...], read(worldKey, columns) -> records
 * (null for a missing column), key(d) -> the storage key of dimension d. Returns {bases, columns, omitted} or null when the
 * world holds none.
 */
export async function collectBases({ list, read, key, limit = BASES_JSON_LIMIT }) {
  const bases = {};
  let columns = 0, omitted = 0, size = 0;
  for (const d of DIMENSIONS) {
    const world = key(d), coords = await list(world);
    for (let i = 0; i < coords.length; i += READ_BATCH) {
      const batch = coords.slice(i, i + READ_BATCH);
      if (size > limit) { omitted += batch.length; continue; }
      const records = await read(world, batch);
      for (const record of records) {
        if (!record) continue;
        const json = baseToJson(record), cost = json.sections.reduce((n, s) => n + s[1].length + s[2].length, 64) + (json.biomes?.length ?? 0);
        if (size + cost > limit) { omitted++; continue; }
        size += cost; columns++;
        (bases[d] ??= []).push(json);
      }
    }
  }
  return columns || omitted ? { bases, columns, omitted } : null;
}

/** Imported JSON `bases` -> records for writeBaseColumns under the new world id; throws on a damaged column. */
export function basesFromJson(bases, key) {
  const out = [];
  if (!bases || typeof bases !== "object") return out;
  for (const d of DIMENSIONS) {
    const list = bases[d];
    if (list === undefined) continue;
    if (!Array.isArray(list)) throw new Error("Saved imported columns are damaged");
    for (const json of list) out.push(baseFromJson(key(d), json));
  }
  return out;
}

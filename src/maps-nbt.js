// data/map_<id>.dat (MapData "map_N") and data/idcounts.dat (short "map") for region export/import, Java 1.7.10.
// MapData.writeToNBT keys: dimension (byte), xCenter/zCenter (int), scale (byte), width/height (short), colors (byte[16384]).
import { NBT } from "./nbt.js";
import { compoundTag } from "./structure-nbt.js";
import { encodeCompressedNbt, decodeCompressedNbt } from "./nbt-compression.js";
import { mapFromJSON, mapToJSON, MAP_BYTES } from "./maps.js";

const tag = (type, value) => ({ type, value });
const unrun = (runs) => { const out = new Int8Array(MAP_BYTES); let at = 0; for (let i = 0; i + 1 < runs.length && at < out.length; i += 2) { const n = Math.min(runs[i + 1], out.length - at); out.fill(runs[i], at, at + n); at += n; } return out; };

export const mapDocument = (json, shiftX = 0, shiftZ = 0) => ({ name: "", tag: compoundTag([["data", compoundTag([
  ["scale", tag(NBT.BYTE, json.scale)], ["dimension", tag(NBT.BYTE, json.dimension)], ["height", tag(NBT.SHORT, 128)], ["width", tag(NBT.SHORT, 128)],
  ["xCenter", tag(NBT.INT, json.xCenter + shiftX)], ["zCenter", tag(NBT.INT, json.zCenter + shiftZ)], ["colors", tag(NBT.BYTE_ARRAY, unrun(json.colors))]])]]) });
export const idCountsDocument = (counter) => ({ name: "", tag: compoundTag([["map", tag(NBT.SHORT, Math.max(0, counter - 1))]]) });

// record.maps = { counter, maps: [mapToJSON...] } -> Map of file name -> gzip bytes (region-export.js hook).
export async function mapDataFiles(maps, shiftX = 0, shiftZ = 0) {
  const files = new Map();
  if (!maps?.maps?.length) return files;
  for (const m of maps.maps) files.set(`data/map_${m.id}.dat`, await encodeCompressedNbt(mapDocument(m, shiftX, shiftZ)));
  files.set("data/idcounts.dat", await encodeCompressedNbt(idCountsDocument(maps.counter)));
  return files;
}
export const isMapFile = ({ filename }) => /(^|\/)(map_\d+|idcounts)\.dat$/.test(filename);
// options.structureData files -> record.maps (region-import.js hook); unreadable files are skipped and counted.
export async function mapsFromFiles(files) {
  const maps = [], report = { found: 0, bad: 0 }; let counter = 0;
  for (const file of files) {
    const m = /(?:^|\/)map_(\d+)\.dat$/.exec(file.filename);
    try {
      const root = (await decodeCompressedNbt(file.bytes)).tag, data = root.value.get("data") ?? root, v = (k) => data.value.get(k)?.value;
      if (m) {
        const colors = v("colors"); report.found++;
        if (!(colors instanceof Int8Array) || colors.length !== MAP_BYTES) { report.bad++; continue; }
        const j = mapToJSON({ ...mapFromJSON({ id: +m[1], scale: v("scale"), xCenter: v("xCenter"), zCenter: v("zCenter"), dimension: v("dimension"), colors: [] }), colors });
        maps.push(j);
      } else if (/idcounts\.dat$/.test(file.filename)) counter = (root.value.get("map")?.value ?? -1) + 1;
    } catch { report.bad++; }
  }
  for (const j of maps) counter = Math.max(counter, j.id + 1);
  return { maps: maps.length ? { counter, maps } : null, report };
}

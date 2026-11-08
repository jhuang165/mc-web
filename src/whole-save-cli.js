// Node CLI whole-save mode (tools/import-java-region.mjs --whole-save): a save folder's entries -> a Blockworld record whose
// `bases` carry the stored full columns as JSON (whole-save-json.js), without IndexedDB.
import { importWholeSave } from "./whole-save-import.js";
import { BASES_JSON_LIMIT, baseToJson, baseFromJson } from "./whole-save-json.js";

const costOf = (json) => json.sections.reduce((n, s) => n + s[1].length + s[2].length, 64) + (json.biomes?.length ?? 0);

// The JSON columns are kept in a Map keyed world/x/z so the population pass (imported-population.js) can read a column back and
// replace it; a replaced column is re-costed. Records over `limit` characters are omitted, as before.
export async function wholeSaveRecord(entries, {name, limit = BASES_JSON_LIMIT, populate = true} = {}) {
  const worldId = 'cli-whole-save', store = new Map(), counts = {omitted: 0};
  let size = 0;
  const writeBases = async (records) => {
    for (const record of records) {
      const json = baseToJson(record), k = `${record.world}|${record.x}|${record.z}`, cost = costOf(json), old = store.get(k);
      if (old) { size -= old.cost; store.delete(k); }
      if (size + cost > limit) { counts.omitted++; continue; }
      size += cost; store.set(k, {json, cost});
    }
  };
  const readBases = async (world, columns) => columns.map(([x, z]) => {
    const hit = store.get(`${world}|${x}|${z}`);
    return hit ? baseFromJson(world, hit.json) : null;
  });
  const {record, report} = await importWholeSave(entries, {worldId, writeBases, readBases, populate, name});
  delete record.id;
  const bases = {};
  let columns = 0;
  for (const [k, {json}] of store) {
    const world = k.slice(0, k.indexOf('|')), dim = world === worldId ? 0 : Number(world.slice(worldId.length + 1));
    (bases[dim] ??= []).push(json); columns++;
  }
  record.bases = bases;
  if (counts.omitted) record.wholeSave = {...record.wholeSave, basesOmitted: counts.omitted};
  return {record, report: {...report, basesJson: {columns, omitted: counts.omitted}}};
}

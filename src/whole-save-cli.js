// Node CLI whole-save mode (tools/import-java-region.mjs --whole-save): a save folder's entries -> a Blockworld record whose
// `bases` carry the stored full columns as JSON (whole-save-json.js), without IndexedDB.
import { importWholeSave } from "./whole-save-import.js";
import { BASES_JSON_LIMIT, baseToJson } from "./whole-save-json.js";

export async function wholeSaveRecord(entries, {name, limit = BASES_JSON_LIMIT} = {}) {
  const worldId = 'cli-whole-save', bases = {}, counts = {columns: 0, omitted: 0};
  let size = 0;
  const writeBases = async (records) => {
    for (const record of records) {
      const dim = record.world === worldId ? 0 : Number(String(record.world).slice(worldId.length + 1));
      const json = baseToJson(record);
      const cost = json.sections.reduce((n, s) => n + s[1].length + s[2].length, 64) + (json.biomes?.length ?? 0);
      if (size + cost > limit) { counts.omitted++; continue; }
      size += cost; counts.columns++;
      (bases[dim] ??= []).push(json);
    }
  };
  const {record, report} = await importWholeSave(entries, {worldId, writeBases, name});
  delete record.id;
  record.bases = bases;
  if (counts.omitted) record.wholeSave = {...record.wholeSave, basesOmitted: counts.omitted};
  return {record, report: {...report, basesJson: {columns: counts.columns, omitted: counts.omitted}}};
}


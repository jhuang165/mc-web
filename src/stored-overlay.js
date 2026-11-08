// Stored-cell original state (see whole-save-columns.js `orig`): what the registry implies for a stored cell without an overlay entry.
import { toOriginal } from './block-registry.js';

const IMPLIED = new Map();
/** The packed original (id << 4 | meta) a stored cell implies without an overlay entry (a fluid with a level reads as flowing), or -1. */
export function impliedOriginal(id, meta) {
  const k = id << 4 | meta;
  let v = IMPLIED.get(k);
  if (v === undefined) { const o = toOriginal(id, meta, { flowing: meta !== 0 }); v = o ? o[0] << 4 | (o[1] & 15) : -1; IMPLIED.set(k, v); }
  return v;
}

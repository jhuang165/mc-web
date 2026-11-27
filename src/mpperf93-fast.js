// Batch 93 mpperf93: server tick speed (results unchanged). MC_MPPERF93=on (default) | off (reference path) | verify (both, throws on the first difference); tests set `fast93.mode`.
//   1. push-grid.js FineGrid: when the entity list of the new grid is the one the retired grid held (same entities in the same order: the usual tick of a settled population),
//      its entity -> index Map is kept as it is (filling a Map costs about 30 KB per 300 entities, every tick), and its cell Map is kept with the cell lists emptied (a stale
//      empty list is harmless: queries only `get` a cell and add its indices; the Map is dropped when it holds far more cells than entities).
//   2. entity-portal.js step: the entity's last position is rewritten in place (one record per entity, not one per step) and the collision box is a scratch pair, not a new array.
import { fast90 } from "./mpperf90-fast.js";
import { fast101 } from "./mpperf101-fast.js"; // b101 mpperf101: kept cells keep their lists

export const fast93 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF93) || "on" };
export const fail93 = (what) => { throw new Error(`mpperf93 ${what} mismatch`); };

// ---- 1. FineGrid ----
// Like recycleOf90 (cell lists emptied, arrays handed over) plus `idxOf` / `cells`: the retired grid's Maps when they still fit `list`, else null.
// Call before the constructor overwrites spare.ents.
export function recycleOf93(spare, list) {
  if (spare === null || spare === undefined || fast90.mode === "off" || fast93.mode === "off") return null;
  const pool = spare.pool ?? [], ents = spare.ents;
  let same = ents.length === list.length && spare.idxOf.size === list.length;
  for (let i = 0; same && i < list.length; i++) if (ents[i] !== list[i]) same = false;
  let cells = null, kept = false;
  if (same && spare.cells.size <= 64 + 4 * list.length) { cells = spare.cells; if (fast101.mode === "off") cells.forEach((c) => { c.length = 0; }); else kept = true; } // b101: a kept cell holds last tick's indices; the constructor moves the changed ones
  else spare.cells.forEach((c) => { c.length = 0; pool.push(c); });
  return { ents, keyAt: spare.keyAt, buf: spare.buf, out: spare.out ?? [], pool, idxOf: same ? spare.idxOf : null, cells, kept };
}
// verify: the kept map is the index map a fresh scan would build.
export function checkIdx93(g, list) {
  if (g.idxOf.size !== list.length) fail93("grid index size");
  for (let i = 0; i < list.length; i++) if (g.idxOf.get(list[i]) !== i) fail93("grid index");
}

// ---- 2. entity portal step ----
const pair = [0, 0];
// boxOf's [half width, height] in a scratch pair (valid until the next call); null where boxOf is.
export function boxPair93(kind, e, boxOf, ENTITY_TYPES, mobScale, SIZES) {
  if (fast93.mode === "off") return boxOf(kind, e);
  let r;
  if (kind === "mob") { const t = ENTITY_TYPES[e.type]; if (!t) r = null; else { const s = mobScale(e); pair[0] = (t.width * s) / 2; pair[1] = t.height * s; r = pair; } }
  else if (kind === "cart" || kind === "boat") r = boxOf(kind, e);
  else { pair[0] = SIZES[kind][0] / 2; pair[1] = SIZES[kind][1]; r = pair; }
  if (fast93.mode === "verify") {
    const ref = boxOf(kind, e);
    if ((ref === null) !== (r === null) || (ref !== null && (!Object.is(ref[0], r[0]) || !Object.is(ref[1], r[1])))) fail93("portal box");
  }
  return r;
}

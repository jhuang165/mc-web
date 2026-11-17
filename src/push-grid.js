// Batch 75 (mppushgrid75): a cell-bucketed candidate lookup for EntityMobs.push (collideWithNearbyEntities), the O(n^2) part of a busy mob tick. Natively
// getEntitiesWithinAABBExcludingEntity looks only at the chunk sections the box touches; here the candidates are the entities within 12 blocks (the old cheap reject),
// handed back in exactly the order `entities` lists them, so every test after the lookup runs on the same entities in the same order as the full scan.
//
// The grid is built from the array when the mob loop's first push asks for it and dropped when the loop ends. Staleness guard: an entity moved off its own turn is
// re-bucketed by `markMoved` (called where positions are written outside a mob's own move: seats, dismounts, piston pushes) and by push itself for the mob, its mount
// and its rider; a changed array length, a moved list index, or a disabled grid falls back to the full scan (`lookup` returns null). MC_PUSHGRID=off disables it;
// MC_PUSHGRID=verify runs both and throws on the first difference (tests and the benchmark use it to prove the two agree).
const CELL = 8, REACH = 12 + 1e-6;
export const pushGridConfig = { mode: (typeof process !== "undefined" && process.env?.MC_PUSHGRID) || "on" }; // tests set `mode` ("on", "off", "verify")
const MIN = (typeof process !== "undefined" && +process.env?.MC_PUSHGRID_MIN) || 200; // measured: no gain at 100 and 300 mobs, about 25% at 600, so smaller scenes keep the plain scan
const key = (cx, cz) => cx * 65536 + cz;
const cellOf = (v) => Math.floor(v / CELL);

export class PushGrid {
  constructor(list) {
    this.list = list; this.ents = list.slice(); this.len = list.length; this.cells = new Map(); this.idxOf = new Map(); this.keyAt = new Array(list.length); this.buf = new Int32Array(256); this.bad = false;
    for (let i = 0; i < list.length; i++) {
      const o = list[i]; this.idxOf.set(o, i);
      const k = Number.isFinite(o?.x) && Number.isFinite(o.z) ? key(cellOf(o.x), cellOf(o.z)) : NaN;
      this.keyAt[i] = k;
      if (k === k) this.cellList(k).push(i);
    }
  }
  cellList(k) { let c = this.cells.get(k); if (!c) this.cells.set(k, (c = [])); return c; }
  // The entity moved off its own turn: put it in the cell of its position now.
  touch(o) {
    const i = this.idxOf.get(o);
    if (i === undefined) return;
    const k = Number.isFinite(o.x) && Number.isFinite(o.z) ? key(cellOf(o.x), cellOf(o.z)) : NaN, was = this.keyAt[i];
    if (k === was) return;
    if (was === was) { const c = this.cells.get(was), j = c.indexOf(i); if (j >= 0) c.splice(j, 1); }
    if (k === k) this.cellList(k).push(i);
    this.keyAt[i] = k;
  }
  // The entities whose cell the 12-block square around (x, z) touches, in list order; null when the array no longer matches the grid.
  query(x, z) {
    const list = this.list, ents = this.ents;
    if (this.bad || list.length !== this.len) return null;
    const x0 = cellOf(x - REACH), x1 = cellOf(x + REACH), z0 = cellOf(z - REACH), z1 = cellOf(z + REACH);
    let n = 0, buf = this.buf;
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const c = this.cells.get(key(cx, cz));
      if (!c) continue;
      if (n + c.length > buf.length) { const g = new Int32Array(Math.max(buf.length * 2, n + c.length)); g.set(buf); this.buf = buf = g; }
      for (let i = 0; i < c.length; i++) buf[n++] = c[i];
    }
    const idx = buf.subarray(0, n).sort(), out = new Array(n);
    for (let i = 0; i < n; i++) { const j = idx[i], o = ents[j]; if (list[j] !== o) { this.bad = true; return null; } out[i] = o; }
    return out;
  }
}

let active = null, looping = false; // the grid of the mob loop that is running (one at a time)
export const beginPushGrid = () => { active = null; fine = null; looping = true; };
export const endPushGrid = () => { active = null; fine = null; looping = false; };
// A position written outside a mob's own move (seat, dismount, piston push, teleport): the active grids file it again.
export const markMoved = (o) => { if (active) active.touch(o); if (fine) fine.touch(o); };

// The candidates for one push of `self` in `list` (an array in list order), or null for the full scan (also whenever no mob loop is running).
export function pushCandidates(list, self) {
  const MODE = pushGridConfig.mode;
  if (MODE === "off" || !looping || list.length < (MODE === "verify" ? 2 : MIN)) return null;
  if (!active || active.list !== list) active = new PushGrid(list);
  active.touch(self); if (self.ridingEntity) active.touch(self.ridingEntity); if (self.riddenBy) active.touch(self.riddenBy); if (self.rider) active.touch(self.rider);
  const near = active.query(self.x, self.z);
  if (near === null) { active = null; return null; }
  if (MODE === "verify") {
    const full = list.filter((o) => Math.abs(o.x - self.x) <= 12 && Math.abs(o.z - self.z) <= 12), got = near.filter((o) => Math.abs(o.x - self.x) <= 12 && Math.abs(o.z - self.z) <= 12);
    if (full.length !== got.length || full.some((o, i) => o !== got[i])) throw new Error(`push grid mismatch: full scan ${full.length}, grid ${got.length}`);
  }
  return near;
}

// ---- Batch 78 (mpperf78): a tight grid for dense scenes ----
// The 12-block candidate list above is still the whole pen when 200 cows stand in 14 x 14 blocks. The push only acts on a candidate whose box meets the mob's box grown by
// 0.2, so the candidates that can matter lie within (the largest half width in the grid) of that box. Entities are filed in 2-block cells by position; an entity wider than
// 6 blocks (a huge slime) sits in `big`, which every query includes. `halfOf(o)` is an upper bound of the half width the box test can use (type width x slime size / 2;
// a foal only grows up to 1). The candidates come back in list order and the caller's own tests (12-block reject, pushable, box test) run on them unchanged, so the pairs
// pushed and their order are exactly those of the full scan. MC_MPPERF78=on|off|verify (tests set `fineConfig.mode`); `verify` compares with the full scan on every push.
const FCELL = 2, FBIG = 3;
export const fineConfig = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF78) || "on", min: (typeof process !== "undefined" && +process.env?.MC_MPPERF78_MIN) || 60 };
export class FineGrid {
  constructor(list, halfOf) {
    this.list = list; this.len = list.length; this.ents = list.slice(); this.halfOf = halfOf; this.cells = new Map(); this.idxOf = new Map(); this.keyAt = new Array(list.length); this.big = []; this.bad = false; this.maxHalf = 0;
    this.buf = new Int32Array(256);
    for (let i = 0; i < list.length; i++) {
      const o = list[i]; this.idxOf.set(o, i);
      const h = halfOf(o);
      if (!(h <= FBIG)) { this.big.push(i); this.keyAt[i] = -1; continue; }
      if (h > this.maxHalf) this.maxHalf = h;
      const k = this.keyOf(o); this.keyAt[i] = k;
      if (k === k) this.cellList(k).push(i);
    }
  }
  keyOf(o) { return Number.isFinite(o?.x) && Number.isFinite(o.z) ? Math.floor(o.x / FCELL) * 1048576 + Math.floor(o.z / FCELL) : NaN; }
  cellList(k) { let c = this.cells.get(k); if (!c) this.cells.set(k, (c = [])); return c; }
  touch(o) {
    const i = this.idxOf.get(o);
    if (i === undefined || this.keyAt[i] === -1) return; // unknown, or in the big list (always a candidate)
    const k = this.keyOf(o), was = this.keyAt[i];
    if (k === was || (k !== k && was !== was)) return;
    if (was === was) { const c = this.cells.get(was), j = c.indexOf(i); if (j >= 0) c.splice(j, 1); }
    if (k === k) this.cellList(k).push(i);
    this.keyAt[i] = k;
  }
  // Candidates for a box `near` ([minX, minY, minZ, maxX, maxY, maxZ]), list order; null when the array no longer matches.
  query(near) {
    const list = this.list, ents = this.ents;
    if (this.bad || list.length !== this.len) return null;
    const H = this.maxHalf + 1e-3, x0 = Math.floor((near[0] - H) / FCELL), x1 = Math.floor((near[3] + H) / FCELL), z0 = Math.floor((near[2] - H) / FCELL), z1 = Math.floor((near[5] + H) / FCELL);
    if (!(x1 - x0 < 64 && z1 - z0 < 64)) return null; // NaN or an enormous box: the full scan
    let n = 0, buf = this.buf;
    const add = (c) => { if (n + c.length > buf.length) { const g = new Int32Array(Math.max(buf.length * 2, n + c.length)); g.set(buf); this.buf = buf = g; } for (let i = 0; i < c.length; i++) buf[n++] = c[i]; };
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const c = this.cells.get(cx * 1048576 + cz); if (c) add(c); }
    if (this.big.length) add(this.big);
    const idx = buf.subarray(0, n).sort(), out = new Array(n);
    for (let i = 0; i < n; i++) { const j = idx[i], o = ents[j]; if (list[j] !== o) { this.bad = true; return null; } out[i] = o; }
    return out;
  }
}
let fine = null;
// The candidates for `self`'s push (box `near`), or null for the other paths. `meets(o)` is the caller's complete pair test, used only by verify.
export function pushNear(list, self, near, halfOf, meets) {
  const MODE = fineConfig.mode;
  if (MODE === "off" || !looping || list.length < (MODE === "verify" ? 2 : fineConfig.min)) return null;
  if (!fine || fine.list !== list) fine = new FineGrid(list, halfOf);
  fine.touch(self); if (self.ridingEntity) fine.touch(self.ridingEntity); if (self.riddenBy) fine.touch(self.riddenBy); if (self.rider) fine.touch(self.rider);
  const got = fine.query(near);
  if (got === null) { fine = null; return null; }
  if (MODE === "verify") {
    const test = (o) => o !== self && Math.abs(o.x - self.x) <= 12 && Math.abs(o.z - self.z) <= 12 && Math.abs(o.y - self.y) <= 12 && meets(o);
    const a = list.filter(test), b = got.filter(test);
    if (a.length !== b.length || a.some((o, i) => o !== b[i])) throw new Error(`mpperf78 push grid mismatch: full ${a.length}, grid ${b.length}`);
  }
  return got;
}

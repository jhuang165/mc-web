// Batch 86 mpperf86: fewer allocations in the server's mob tracker pass (results unchanged). MC_MPPERF86=on (default) | off (reference paths) | verify (both,
// throws on the first difference); tests set `fast86.mode`. This module imports nothing.
//   1. seqOrder: server-mobs.js track's packets in sending order (packetSeq) without a [seq, entry, packet] triple per packet and a comparator sort: the stamps
//      of one pass are distinct integers in a short range, so each packet goes into a reused slot array by its stamp. Duplicate or non-integer stamps, or a
//      range much wider than the count, take the reference sort.
//   2. plainPacket / wireNum / parsedState: track's per-watcher copies without the `...rest` object of the destructure (a packet that carries none of the
//      dropped keys is copied whole), the wire number of a mob cached per entity (a string replace per packet before), and the parsed state of a resent state
//      string cached when its values are all primitives (a JSON.parse per resend before; the copy spreads the cached object, so nothing cached is handed out).
//   3. stateDiffs86: mpperf77's stateDiffs without the Map entry pairs and Set iterators (forEach), same lists in the same order.
//   4. entity-tracker.js walk(): one pass over the HashSet table (no keys() array and no filter array); server-mob-entries.js serverStep: one walk list for the
//      location pass and every flagged watcher's pass (nothing in those passes adds or removes an entry), and the removal pass without Map entry pairs.
//   5. item-entities.js: an item's move gathers its collision boxes into pooled scratch boxes (constant-cell table from mpperf81-fast.js constCellTable, the
//      same probe as cellBoxesOf) and moves a scratch box, burn's lava test reads six numbers, and tickOne skips waterAcceleration's push scan when no water
//      cell touches the item box (the push is then zero; `+= 0` keeps -0 handling). The fast move runs only on a real World (solid and get unchanged).
export const fast86 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF86) || "on" };
export const fail86 = (what) => { throw new Error(`mpperf86 ${what} mismatch`); };

// ---- 1. packets in stamp order ----
// `parts`: the entries ({ entry: { packets } }) of the pass, `seqOf(packet)` the stamp. Fills `sc.pk` / `sc.en` (reused) and returns the count, or -1 when the
// stamps do not fit the slot order (the caller sorts as before).
export function seqOrder(parts, seqOf, sc) {
  const pk = sc.pk, en = sc.en, sq = sc.sq;
  let n = 0, lo = Infinity, hi = -Infinity;
  for (let a = 0; a < parts.length; a++) {
    const e = parts[a], list = e.entry.packets;
    for (let b = 0; b < list.length; b++) {
      const p = list[b], s = seqOf(p);
      pk[n] = p; en[n] = e; sq[n] = s; n++;
      if (s < lo) lo = s;
      if (s > hi) hi = s;
    }
  }
  if (n <= 1) { sc.n = n; return n; }
  const span = hi - lo + 1;
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || span > 4 * n + 256) return clear(sc, n, -1);
  const slotP = sc.slotP, slotE = sc.slotE;
  if (slotP.length < span) { slotP.length = span; slotE.length = span; }
  for (let k = 0; k < n; k++) {
    const s = sq[k] - lo;
    if (!Number.isInteger(s) || slotP[s] !== undefined) { for (let j = 0; j < k; j++) { const t = sq[j] - lo; slotP[t] = undefined; slotE[t] = undefined; } return clear(sc, n, -1); }
    slotP[s] = pk[k]; slotE[s] = en[k];
  }
  let m = 0;
  for (let s = 0; s < span; s++) {
    const p = slotP[s];
    if (p === undefined) continue;
    pk[m] = p; en[m] = slotE[s]; m++;
    slotP[s] = undefined; slotE[s] = undefined;
  }
  sc.n = n;
  return n;
}
function clear(sc, n, ret) { for (let k = 0; k < n; k++) { sc.pk[k] = undefined; sc.en[k] = undefined; } sc.n = 0; return ret; }
export const seqScratch = () => ({ pk: [], en: [], sq: [], slotP: [], slotE: [], n: 0 });
// Drops the references the scratch holds after a pass (the packets are dead after it).
export function seqDone(sc) { for (let k = 0; k < sc.n; k++) { sc.pk[k] = undefined; sc.en[k] = undefined; } sc.n = 0; }

// ---- 2. per-watcher copies ----
// True when `{ ...pk, i }` is the reference's `{ ...rest, i }` (rest = pk without entity, vehicle, holder and after): none of those keys is on the packet.
export const plainPacket = (pk) => !("entity" in pk) && !("vehicle" in pk) && !("holder" in pk) && !("after" in pk);
const nums = new WeakMap(); // entity -> { id, n }
export function wireNum(e, num) {
  let c = nums.get(e);
  if (c === undefined || !Object.is(c.id, e.id)) { c = { id: e.id, n: num(e) }; nums.set(e, c); }
  if (fast86.mode === "verify" && !Object.is(c.n, num(e))) fail86("wireNum");
  return c.n;
}
const parsed = new Map(); // state string -> its JSON.parse when every value is a primitive, else null
export function parsedState(s) {
  let p = parsed.get(s);
  if (p === undefined) {
    const o = JSON.parse(s);
    p = o !== null && typeof o === "object" && !Array.isArray(o) && Object.values(o).every((v) => v === null || typeof v !== "object") ? o : null;
    if (parsed.size >= 4096) parsed.clear();
    parsed.set(s, p);
  }
  return p ?? JSON.parse(s);
}
// verify helper: two packets have the same own keys in the same order with Object.is-equal values (nested values compared as JSON).
export function samePacket(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (let k = 0; k < ka.length; k++) {
    if (ka[k] !== kb[k]) return false;
    const x = a[ka[k]], y = b[kb[k]];
    if (x !== null && typeof x === "object") { if (y === null || typeof y !== "object" || JSON.stringify(x) !== JSON.stringify(y)) return false; }
    else if (!Object.is(x, y)) return false;
  }
  return true;
}

// ---- 3. state resend lists ----
// mpperf77-fast.js stateDiffs (its fast path): per entry in Map order, its watchers in set order, each watcher's views; the first ask computes the state string.
export function stateDiffs86(views, entries, stateOf) {
  const byWatcher = new Map(), out = new Map();
  for (const v of views) { const l = byWatcher.get(v.watcher); if (l) l.push(v); else byWatcher.set(v.watcher, [v]); }
  let e = null, s;
  const visit = (w) => {
    const vs = byWatcher.get(w);
    if (vs === undefined) return;
    for (let k = 0; k < vs.length; k++) {
      const v = vs[k];
      if (s === undefined) s = stateOf(e);
      if (v.known.get(e) !== s) { const l = out.get(v); if (l) l.push([e, s]); else out.set(v, [[e, s]]); }
    }
  };
  entries.forEach((en, key) => {
    const set = en.entry.set;
    if (!set.size) return;
    e = key; s = undefined;
    set.forEach(visit);
  });
  return out;
}

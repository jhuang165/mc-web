// Batch 61 (trackerorder). What the tracker saw of the Overworld's spawn-area entities on each tick of an away run.
// The b60 catch-up ran the silent tracker ticks (idleUpdate) with every entity at its FINAL state, so an entry's last sent position, motion and angles (and the age of an
// entity that spawned during the trip) were not the ones the native EntityTracker left: MinecraftServer ticks every world's tracker each tick (bytecode-read, b59), so the entry
// of a moving entity follows it. The worker samples each entity's tracker-visible fields after every entity tick (the first 1200: mt.h freezes the world after that); the main
// thread replays them in order, per tick, before the final-state ticks (away-track.js).
// An entity is keyed by its saved record's `ord` (saved-order.js stamps it in finish; restoreSavedOrder gives the loaded entity the same number in `orderSeqs`).
const NUM = ["x", "y", "z", "posY", "mx", "my", "mz", "vx", "vy", "vz", "yaw", "pitch", "rotationYaw", "rotationPitch", "rotationYawHead"];
// Entity.addVelocity / setBeenAttacked set these and the TRACKER clears them (settle); the run has no tracker, so a flag only latches. A rise is counted and replayed once.
const FLAGS = ["airBorne", "velocityChanged"];
// The id the tracker hashes (Entity.getEntityId): a mob's "mob-N", an object's entityId or numeric id.
const idNumber = (e) => { const id = e.entityId ?? e.id; const n = typeof id === "string" ? Number((/(\d+)$/.exec(id) ?? [])[1]) : id; return Number.isInteger(n) ? n : null; };
export const RISE = "!"; // a replayed field named "!name" is a flag counter: the flag is set on the tick the counter rises

export class AwayTrace {
  // `lists()`: every entity that can move in the run (one flat array, called once per sample)
  constructor(lists) { this.lists = lists; this.rows = new Map(); this.n = 0; this.born = []; this.transients = []; } // b65: `born` is the world's `traceBorn` (spawns and removed mobs since the last sample), `transients` [id, tick]
  sample() {
    const t = this.n++, list = this.lists();
    this.noteTransients(t, list);
    for (const e of list) {
      if (!e || typeof e !== "object") continue;
      let r = this.rows.get(e);
      if (!r) this.rows.set(e, (r = { from: t, id: idNumber(e), fields: NUM.filter((f) => Number.isFinite(e[f])), rise: [0, 0], was: [false, false], last: null, samples: [] }));
      if (r.at === t) continue; // listed twice in one tick
      r.at = t;
      FLAGS.forEach((f, i) => { if (e[f]) { r.rise[i]++; e[f] = false; } }); // the flag is cleared here as the tracker clears it after a send, so any flag seen is a new set // b62: the tracker clears the flag after each send, so a later rise counts again (nothing else in the run reads it)
      const v = r.fields.map((f) => e[f]);
      v.push(r.rise[0], r.rise[1]);
      if (r.last && v.every((x, i) => x === r.last[i])) continue;
      r.last = v; r.samples.push(t, ...v);
    }
  }
  // b65 (trackertransient2): an entity that spawned and was removed inside tick `t` was never in a list at a sample, so it has no row and no ghost; natively it took a HashSet slot at its spawn and gave it
  // back at its death (tracker-transient.js). It is kept as [id, tick] and replayed as an add and a remove in that tick (`transientsAt`, EntityTracker idleUpdate). Entities still alive are not transient.
  noteTransients(t, list) {
    if (!this.born.length) return;
    const alive = new Set(list);
    for (const e of this.born.splice(0)) {
      if (!e || this.rows.has(e) || alive.has(e) || (e.dead !== true && e.transientGone !== true)) continue;
      const id = idNumber(e);
      if (id !== null && this.transients.length < 4096) this.transients.push([id, t]);
    }
  }
  // `pairs`: [[entity, saved record]] of the entities that are saved (a dead entity has no record and is not replayed). Rows that never change after tick 0 are not sent.
  finish(pairs) {
    const rows = [];
    for (const [e, rec] of pairs) {
      const r = this.rows.get(e);
      if (!r || !Number.isFinite(rec?.ord)) continue;
      const stride = r.fields.length + 3;
      if (r.from === 0 && r.samples.length === stride) continue;
      rows.push({ ord: rec.ord, from: r.from, fields: [...r.fields, RISE + FLAGS[0], RISE + FLAGS[1]], data: Float64Array.from(r.samples) });
    }
    // b62: an entity that was sampled but is not in the lists any more died (or left through a portal) in the run: natively the tracker held its entry until the tick it was removed, which
    // grew the HashSet's table (the capacity never shrinks) and so changed the order of every entry after it. [id, first tracker tick, last tracker tick].
    const alive = new Set(this.lists()), ghosts = [];
    for (const [e, r] of this.rows) if (!alive.has(e) && Number.isInteger(r.id) && r.at !== undefined) ghosts.push([r.id, r.from, r.at]);
    return { n: this.n, rows, ghosts, transients: this.transients };
  }
}

// Main thread: binds the rows to the loaded entities (`entityOf(ord)` -> entity or null) and returns { rows, final, per }.
// per(i): the entities not yet born at tick i are `absent`; the others take their sample for tick i.
export function bindTrace(trace, entityOf) {
  const rows = [];
  for (const r of trace?.rows ?? []) {
    const e = entityOf(r.ord);
    if (!e) continue;
    const stride = r.fields.length + 1;
    rows.push({ e, from: r.from, fields: r.fields, data: r.data, stride, at: 0, rise: r.fields.map((f) => (f[0] === RISE ? 0 : null)), keep: r.fields.map((f) => e[f[0] === RISE ? f.slice(1) : f]) });
  }
  rows.sort((a, b) => a.from - b.from);
  return rows;
}
// Puts every bound entity in its state at tick `i` (the sample at or before it; `absent` holds the ones born later). Returns true when `absent` changed.
export function applyTick(rows, i, absent) {
  let changed = false;
  for (const r of rows) {
    if (i < r.from) { if (!absent.has(r.e)) { absent.add(r.e); changed = true; } continue; }
    if (absent.delete(r.e)) changed = true;
    while (r.at < r.data.length && r.data[r.at] <= i) {
      const base = r.at + 1;
      r.fields.forEach((f, k) => {
        const v = r.data[base + k];
        if (f[0] !== RISE) { r.e[f] = v; return; }
        if (v > r.rise[k]) { r.e[f.slice(1)] = true; r.rise[k] = v; }
      });
      r.at += r.stride;
    }
  }
  return changed;
}
// The ghosts' ids that the tracker still holds at tick `i` (died later than i, born at or before it).
export const ghostsAt = (trace, i) => (trace?.ghosts ?? []).filter(([, from, to]) => from <= i && i <= to).map(([id]) => id);
// b65: the ids of the entities that were added and removed inside tick `i`.
export const transientsAt = (trace, i) => (trace?.transients ?? []).filter(([, t]) => t === i).map(([id]) => id);
// Back to the state the entities have now (the end of the trace).
export function restoreFinal(rows) { for (const r of rows) r.fields.forEach((f, k) => { r.e[f[0] === RISE ? f.slice(1) : f] = r.keep[k]; }); }

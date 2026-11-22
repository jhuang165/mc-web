// Batch 77 mpperf77: three exact speed-ups found by the player/Nether/End server benchmarks (tools/bench-server-players.mjs), each with the old code kept beside it.
// MC_MPPERF77=on (default) | off (reference paths) | verify (both, throws on the first difference); tests set `fastConfig.mode`.
//   1. pushMeets: EntityMobs.push's box test without building the candidate's pushBox and size arrays (same float arithmetic as boxesMeet(near, pushBox(o, ...size(o)))).
//   2. nearbyLate: EntityBrain.nearby for a test whose expensive part (a line-of-sight ray) is pure: the box check runs first so the ray is only cast for mobs
//      inside the box. Natively World.getEntitiesWithinAABB picks the entities first and canSee runs on those only.
//   3. stateDiffs: SharedMobTracker state resend per tracking view: walks each entry's watcher set instead of testing every (view, entry) pair.
import { boxesMeet } from './combat.js';

export const fastConfig = { mode: (typeof process !== 'undefined' && process.env?.MC_MPPERF77) || 'on' };
const f = Math.fround, SCRATCH = [0, 0];

// ---- 1. push box test ----
export const pushMeetsReference = (near, o, world, pushBox) => boxesMeet(near, pushBox(o, ...world.size(o)));
export function pushMeets(near, o, world, pushBox) {
  const mode = fastConfig.mode;
  if (mode === 'off') return pushMeetsReference(near, o, world, pushBox);
  const s = world.sizeInto(o, SCRATCH), w = f(f(s[0]) / 2), h = f(s[1]);
  const r = o.x + w > near[0] && o.x - w < near[3] && o.y + h > near[1] && o.y < near[4] && o.z + w > near[2] && o.z - w < near[5];
  if (mode === 'verify' && r !== pushMeetsReference(near, o, world, pushBox)) throw new Error('mpperf77 pushMeets mismatch');
  return r;
}

// ---- 2. nearby with the pure expensive test last ----
// `entities` is the brain's candidate list, `skip(e)` the dead/self filter, `brainOf(e)`, `cheap(b)` the side-effect-free type test, `late(b)` the pure expensive test (its only
// side effect is the per-tick sense cache), `overlaps(b)` the box test. Result = the brains for which cheap, late and overlaps all hold, in list order.
export function nearbyLate(entities, skip, brainOf, cheap, late, overlaps) {
  const mode = fastConfig.mode, out = [];
  if (mode !== 'on') {
    const ref = [];
    for (const e of entities) { if (skip(e)) continue; const b = brainOf(e); if (cheap(b) && late(b) && overlaps(b)) ref.push(b); }
    if (mode === 'off') return ref;
    for (const e of entities) { if (skip(e)) continue; const b = brainOf(e); if (cheap(b) && overlaps(b) && late(b)) out.push(b); }
    if (out.length !== ref.length || out.some((b, i) => b !== ref[i])) throw new Error('mpperf77 nearbyLate mismatch');
    return out;
  }
  // b96 mpperf96: an index loop (the array iterator's per-step result is gone; the same elements in the same order); `entities` may be a Set-free array only
  if (Array.isArray(entities)) { for (let i = 0; i < entities.length; i++) { const e = entities[i]; if (skip(e)) continue; const b = brainOf(e); if (cheap(b) && overlaps(b) && late(b)) out.push(b); } return out; }
  for (const e of entities) { if (skip(e)) continue; const b = brainOf(e); if (cheap(b) && overlaps(b) && late(b)) out.push(b); }
  return out;
}

// ---- 3. tracker state resend ----
// entries: Map(entity -> { entry: { set: Set(watcher) } }); views: iterable of { watcher, known: Map(entity -> state string) }. Returns Map(view -> [[entity, state], ...]) for the
// views whose known state differs, each list in entry order (known is not changed here).
export function stateDiffsReference(views, entries, stateOf) {
  const out = new Map();
  for (const v of views) {
    const list = [];
    for (const [e, en] of entries) {
      if (!en.entry.set.has(v.watcher)) continue;
      const s = stateOf(e);
      if (v.known.get(e) !== s) list.push([e, s]);
    }
    if (list.length) out.set(v, list);
  }
  return out;
}
export function stateDiffs(views, entries, stateOf) {
  const mode = fastConfig.mode;
  views = [...views]; // an iterator is read once
  if (mode === 'off') return stateDiffsReference(views, entries, stateOf);
  const byWatcher = new Map(), out = new Map();
  for (const v of views) { const l = byWatcher.get(v.watcher); if (l) l.push(v); else byWatcher.set(v.watcher, [v]); }
  for (const [e, en] of entries) {
    const set = en.entry.set;
    if (!set.size) continue;
    let s;
    for (const w of set) {
      const vs = byWatcher.get(w);
      if (!vs) continue;
      for (const v of vs) {
        if (s === undefined) s = stateOf(e);
        if (v.known.get(e) !== s) { const l = out.get(v); if (l) l.push([e, s]); else out.set(v, [[e, s]]); }
      }
    }
  }
  if (mode === 'verify') {
    const ref = stateDiffsReference(views, entries, stateOf);
    const same = ref.size === out.size && [...ref].every(([v, l]) => { const m = out.get(v); return m && m.length === l.length && l.every(([e, s], i) => m[i][0] === e && m[i][1] === s); });
    if (!same) throw new Error('mpperf77 stateDiffs mismatch');
  }
  return out;
}

// Batch 60 (awaytracker). The tracker ticks the Overworld's spawn area ran while the player was in the Nether or End, for the NON-mob entities too.
// Bytecode-read (b59 trackeridle): MinecraftServer runs EntityTracker.updateTrackedEntities for every WorldServer with no player test, and the chunks within 128 blocks of the spawn stay loaded,
// so every entity there - items, orbs, arrows, thrown entities, carts, boats, TNT, falling blocks, paintings, frames, knots - keeps a tracker entry with its counters running.
// Executed (tracker-joint-reference.json b58tp dimAge cases, replayed by trackerphase-b58.test.js): mob and object entries made in an unwatched world run `idleUpdate` and are sent at the join in set order.
import { inSpawnArea } from "./away-plan.js";
import { reduceIdleTicks } from "./entity-tracker.js";
import { bindTrace, applyTick, restoreFinal, ghostsAt } from "./away-trace.js";

const posOf = (e) => (e.summoned ? [e.px, e.pz] : [e.x, e.z]);
// Which entities were in the loaded area: their chunk (block x, z >> 4) is within the spawn square
export const keptIn = (spawn) => (e) => { const [x, z] = posOf(e); return Number.isFinite(x) && Number.isFinite(z) && inSpawnArea(spawn, Math.floor(x) >> 4, Math.floor(z) >> 4); };

// `mobs`: the EntityWorld; `o`: the world's ObjectTracker (its hooks give the boats, carts, hangings and knots); `lists`: kind -> live entities (main.js trackLists, without the angler's hook).
// The tracker catches up `ticks` silent ticks for the kept mobs and objects together (one HashSet order, one id sort), so the later join sends them as the native EntityTracker would.
// b61 (away-trace.js): with `idle.trace` the first ticks of the trip (the entity ticks the worker ran) put each entity in the state it had on that tick, and an entity the run spawned
// is made at its own first tick (its age is its own); the rest of the trip runs on the final state, as before.
export function awayCatchUp(mobs, o, lists, world, idle) {
  const keep = keptIn(idle.spawn), absent = new Set(), cur = (e) => keep(e) && !absent.has(e), kept = {};
  const refresh = () => { for (const k in lists) if (k !== "fishHook") kept[k] = lists[k].filter(cur); };
  refresh();
  const hook = o.hooks.extraLists;
  if (hook) o.hooks.extraLists = () => { const x = hook(), out = {}; for (const k in x) out[k] = x[k].filter(cur); return out; };
  try {
    const trace = idle.trace?.n > 0 ? bindTrace(idle.trace, ordOf(mobs, lists, hook)) : [];
    const total = reduceIdleTicks(idle.ticks), n = trace.length ? Math.min(idle.trace.n, total) : 0;
    if (n) {
      let first = true;
      const per = (i) => { // the state of tick i; the entities born later are left out of this tick's lists
        const changed = applyTick(trace, i, absent);
        if (changed || first) { refresh(); first = false; }
        return { mobs: mobs.entities.filter(cur), joint: { tracker: o, lists: kept, world }, ghosts: ghostsAt(idle.trace, i) };
      };
      try { mobs.idleTrack(n, keep, { tracker: o, lists: kept, world }, per); } finally { restoreFinal(trace); absent.clear(); refresh(); mobs.tracker?.dropGhosts(); }
    }
    mobs.idleTrack(total - n, keep, { tracker: o, lists: kept, world });
  } finally { if (hook) o.hooks.extraLists = hook; }
}

// ord (the saved record's place stamp) -> the loaded entity: restoreSavedOrder gave every restored entity `ord + 1` in orderSeqs
function ordOf(mobs, lists, extra) {
  const all = [...mobs.entities, ...(mobs._fireballs?.list ?? []), ...(mobs._skulls?.list ?? []), ...[...(mobs.walks?.values() ?? [])].flatMap((w) => w.list()), ...Object.values(lists).flat(), ...Object.values(extra?.() ?? {}).flat()];
  const by = new Map();
  for (const e of all) { const s = mobs.orderSeqs?.get(e); if (Number.isFinite(s) && !by.has(s - 1)) by.set(s - 1, e); }
  return (ord) => by.get(ord) ?? null;
}

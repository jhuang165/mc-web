// Batch 60 (awaytracker). The tracker ticks the Overworld's spawn area ran while the player was in the Nether or End, for the NON-mob entities too.
// Bytecode-read (b59 trackeridle): MinecraftServer runs EntityTracker.updateTrackedEntities for every WorldServer with no player test, and the chunks within 128 blocks of the spawn stay loaded,
// so every entity there - items, orbs, arrows, thrown entities, carts, boats, TNT, falling blocks, paintings, frames, knots - keeps a tracker entry with its counters running.
// Executed (tracker-joint-reference.json b58tp dimAge cases, replayed by trackerphase-b58.test.js): mob and object entries made in an unwatched world run `idleUpdate` and are sent at the join in set order.
import { inSpawnArea } from "./away-plan.js";

const posOf = (e) => (e.summoned ? [e.px, e.pz] : [e.x, e.z]);
// Which entities were in the loaded area: their chunk (block x, z >> 4) is within the spawn square
export const keptIn = (spawn) => (e) => { const [x, z] = posOf(e); return Number.isFinite(x) && Number.isFinite(z) && inSpawnArea(spawn, Math.floor(x) >> 4, Math.floor(z) >> 4); };

// `mobs`: the EntityWorld; `o`: the world's ObjectTracker (its hooks give the boats, carts, hangings and knots); `lists`: kind -> live entities (main.js trackLists, without the angler's hook).
// The tracker catches up `ticks` silent ticks for the kept mobs and objects together (one HashSet order, one id sort), so the later join sends them as the native EntityTracker would.
export function awayCatchUp(mobs, o, lists, world, idle) {
  const keep = keptIn(idle.spawn), kept = {};
  for (const k in lists) if (k !== "fishHook") kept[k] = lists[k].filter(keep);
  const hook = o.hooks.extraLists;
  if (hook) o.hooks.extraLists = () => { const x = hook(), out = {}; for (const k in x) out[k] = x[k].filter(keep); return out; };
  try { mobs.idleTrack(idle.ticks, keep, { tracker: o, lists: kept, world }); } finally { if (hook) o.hooks.extraLists = hook; }
}

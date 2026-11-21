// Batch 89 mpperf89: server tick speed (results unchanged). MC_MPPERF89=on (default) | off (reference paths) | verify (both where both can run, throws on the first
// difference); tests set `fast89.mode`. This module imports nothing.
//   1. Map.forEach / index loops for the for-of loops left in the per-tick paths (multiplayer/thrown-tracks.js update, multiplayer/server-vehicles.js track, simulation.js
//      tick's player loops), and guards that skip a loop (with its copied key list) when it would do nothing.
//   2. entities.js restore: a restored mob (saved worlds, java-mobs.js imports, /summon with a record, ridden mounts, horse spawns) gets mobShape88's number-field
//      representation as a created one does (restoreShaped89).
//   3. Two allocators: EntityWorld's `ai` getter made a function context on every read (its MobAI dependency closures capture `this`), and Brain.updateAITasks (and the
//      legacy creatures' think) cleared an empty senseCache Map every tick, which allocates in the Map.prototype.clear builtin.
//   4. CPU: ai.js TaskList.canUse (EntityAITasks.canUse, uj.a(uk)) walked every task and asked running.includes for each; only running tasks can refuse, so it walks those.
//      TaskList.tick (uj.a()) runs as taskTick89: the same steps with index loops and no snapshot copy of a running list of 0 or 1 tasks.
export const fast89 = { mode: (typeof process !== "undefined" && process.env?.MC_MPPERF89) || "on" };
export const fail89 = (what) => { throw new Error(`mpperf89 ${what} mismatch`); };

// ---- 1. loops ----
// `fn(value, key)` for each entry of a Map (a Set gives (value, value), an array (value, index)), in the order and with the live semantics of `for (const [key, value] of map)`:
// Map.prototype.forEach visits entries added during the walk and skips ones deleted before they are reached, as the Map iterator does. Off runs the for-of loop itself.
// The callback cannot `continue`, `break` or `return` from the caller; callers only convert loops that do none of those.
export function eachValue89(c, fn) {
  if (fast89.mode === "off") {
    if (Array.isArray(c)) { let i = 0; for (const v of c) fn(v, i++); }
    else if (c instanceof Map) for (const [k, v] of c) fn(v, k);
    else for (const v of c) fn(v, v);
    return;
  }
  if (Array.isArray(c)) { for (let i = 0; i < c.length; i++) fn(c[i], i); return; }
  c.forEach(fn);
}
// thrown-tracks.js update: does any watcher belong to a player who is not in `players` (the untrack loop has something to drop)?
export function leftAny89(watchers, players) {
  if (watchers.size === 0) return false;
  let any = false;
  watchers.forEach((w, pid) => { if (!any && !players.has(pid)) any = true; });
  return any;
}
// thrown-tracks.js update: is any tracked entity missing from `alive` (the end loop has an entry to remove)?
export function anyGone89(objs, alive) {
  if (objs.size === 0) return false;
  if (objs.size > alive.size) return true;
  let any = false;
  objs.forEach((o, e) => { if (!any && !alive.has(e)) any = true; });
  return any;
}
// thrown-tracks.js update: is any listed entity not tracked yet (the add loop has an entry to make)?
export function anyNew89(list, objs) {
  for (let k = 0; k < list.length; k++) if (!objs.has(list[k].e)) return true;
  return false;
}

// ---- 2. restored mobs ----
// Wraps EntityWorld.prototype.restore (applied after every install*() wrapper, so the record is final): a non-null result goes through mobShape88 (which itself does nothing
// with MC_MPPERF88=off). mobShape88 keeps the keys, their order and every value; verify checks that here too.
export function restoreShaped89(restore, shape) {
  return function restore89(e, opts) {
    const out = restore.call(this, e, opts);
    if (out === null || out === undefined || typeof out !== "object" || fast89.mode === "off") return out;
    if (fast89.mode !== "verify") return shape(out);
    const keys = Object.keys(out), vals = keys.map((k) => out[k]);
    shape(out);
    const now = Object.keys(out);
    if (now.length !== keys.length || now.some((k, i) => k !== keys[i] || !Object.is(out[k], vals[i]))) fail89("restore shape");
    return out;
  };
}

// ---- 3. allocators ----
// entities.js `get ai`: the MobAI once made (mobAI) is answered without entering makeAI89, whose closures need a context on every call. verify checks it is the same object.
export function aiOf89(w) {
  const ai = w.mobAI;
  if (ai === undefined || ai === null) return w.makeAI89();
  if (fast89.mode === "verify" && w.makeAI89() !== ai) fail89("ai");
  return ai;
}

// ---- 4. TaskList.canUse ----
// The reference (ai.js canUse): for each other task, `on` = running.includes(other); a higher-or-equal priority running task sharing a mutex bit refuses, as does a
// lower-priority running task that is not interruptible. A task that is not running never refuses, so only the running list needs walking; a running task that would
// refuse counts only while it is still in `entries` (normally every running entry is: add pushes there and remove takes an entry out of running with it, but a task removed
// during tick's own walk can be pushed to running afterwards). isInterruptible has no side effects (Task's returns true; no task overrides it), so the answer and every
// observable effect are the same. verify runs both.
export function canUse89(t, entry) {
  const running = t.running;
  let ok = true;
  for (let k = 0; k < running.length; k++) {
    const other = running[k];
    if (other === entry) continue;
    const refuses = entry.priority >= other.priority ? (entry.action.mutex & other.action.mutex) !== 0 : !other.action.isInterruptible();
    if (refuses && t.entries.includes(other)) { ok = false; break; } // a running task no longer in the list (removed during this tick's walk) is not asked by the reference
  }
  if (fast89.mode === "verify" && ok !== canUseReference89(t, entry)) fail89("canUse");
  return ok;
}
// ai.js TaskList.canUse as it stands (kept here for verify).
export function canUseReference89(t, entry) {
  for (const other of t.entries) {
    if (other === entry) continue;
    const on = t.running.includes(other);
    if (entry.priority >= other.priority) {
      if (on && (entry.action.mutex & other.action.mutex) !== 0) return false;
    } else if (on && !other.action.isInterruptible()) return false;
  }
  return true;
}
// ai.js TaskList.tick as it stands, with index loops (a for-of loop over an array reads the live length and index the same way, so entries added or removed during a
// task's callback are met alike), canUse89 for canUse (no task list overrides canUse), and the updateTask pass walking a copy of `running` only when it holds 2 or more
// tasks (the copy of 0 or 1 entries visits the same entry, read before its call). `t.running` is re-read at every use as the reference does.
export function taskTick89(t) {
  if (t.tickCount++ % t.rate === 0) {
    let started = null;
    const entries = t.entries; // the for-of loop holds the array it started on
    for (let k = 0; k < entries.length; k++) {
      const entry = entries[k];
      if (t.running.includes(entry)) {
        if (canUse89(t, entry) && entry.action.continueExecuting()) continue;
        entry.action.resetTask();
        t.running.splice(t.running.indexOf(entry), 1);
      }
      if (canUse89(t, entry) && entry.action.shouldExecute()) {
        (started ??= []).push(entry);
        t.running.push(entry);
      }
    }
    if (started !== null) for (let k = 0; k < started.length; k++) started[k].action.startExecuting();
  } else
    for (let i = 0; i < t.running.length; ) {
      const entry = t.running[i];
      if (entry.action.continueExecuting()) i++;
      else {
        entry.action.resetTask();
        t.running.splice(i, 1);
      }
    }
  const running = t.running;
  if (running.length === 1) running[0].action.updateTask();
  else if (running.length > 1) { const snap = running.slice(); for (let k = 0; k < snap.length; k++) snap[k].action.updateTask(); }
}

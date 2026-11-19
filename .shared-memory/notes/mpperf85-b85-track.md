# Batch 85 mpperf85: tracker allocations, mobTargets lists

## Summary
- New `src/mpperf85-fast.js` (`MC_MPPERF85=on|off|verify`, default on; verify runs both paths and throws on the first difference; no imports).
  1. `entity-tracker.js` `stepEntry`: size written into a scratch through `sizeOf.into` (server-mobs.js `track` now builds its size closure once, with `into`), and `observe()`'s record replaced by `airBorneOf` / `changedOf` (`observe` still exists and is used when a subclass overrides it: object-tracker.js keeps its record).
  2. `copy-meta.js` `copyMetaDiff`: compares the watched values in `copyMetaOf`'s key order without building the record for every mob every tick (reference kept as `copyMetaDiffReference`).
  3. `server-mob-entries.js`: `serverStep` marks live entries with a tick stamp instead of `new Set(mobs)`, and skips sizing a mob that already has an entry; `SharedEntry.emit` shares one destination array (per-watcher `solo`, or a snapshot of the set re-checked each use) instead of a new array per packet.
  4. `server-mobs.js` `track`: no per-tick `states` Map (the state string is a pure function of the mob; stateDiffs asks once per entry).
  5. `projectiles.js` `mobTargets`: returns the `{ ref, box }` record itself, no one-element list per mob.
- Not done: the `{ ref, box }` record cannot be cached per slot (server-dispense.js writes `t.thrower = true` on records); the once-per-tick lane target list (the same mutation, plus hits moving or killing targets, makes the invalidation not cheap); per-packet `queue` triples and the `...rest` destructure in `track`; `walk()`'s filter array.

## Evidence
- Executed, `tools/bench-alloc81.mjs` (3 runs, 150 ticks, noisy machine, wall time unreliable): heap growth travel 2586 -> 2490 KB/tick (-4%), pen 812 -> 733 KB/tick (-10%); ms/tick within noise (travel 7.3-8.8 off vs 7.8-8.0 on).
- Executed `--state` hashes (travel, pen, terrain): off, on and verify (with MC_MPPERF84/83=verify) identical.
- Port-read: no game rule changed; no bytecode read.

## Verification
- `node --test src/mpperf85-b85.test.js` (copyMetaDiff in three modes, mobTargets, seeded hashes via the bench).
- 68 neighbour files (tracker, mpperf, projectiles, mpdispense, multiplayer, mob, copy): 923 pass, 0 fail with `MC_MPPERF85=verify MC_MPPERF84=verify MC_MPPERF83=verify`. The first verify run failed 142 because ObjectTracker overrides `observe`; fixed by using the fast path only when `observe` is not overridden.
- No full npm test, no browser checks, no build.

## Follow-ups
- Per-packet allocations in `track` (queue triples, rest destructure, JSON.parse of states for diffs), `walk()` filter array.
- Lane target list once per tick needs records that sinks cannot mutate.

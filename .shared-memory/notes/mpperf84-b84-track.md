# Batch 84 mpperf84: cached mob target boxes, aiMoveSpeed without modifier arrays, stepBlock scratch, indexed collision loops

## Summary
- New `src/mpperf84-fast.js` (`MC_MPPERF84=on|off|verify`, default on; verify runs both paths and throws on the first difference; no imports).
  1. `boxStore` / `mobBoxAt`: projectiles.js `mobTargets` builds each mob's box through a per-list-slot cache (one WeakMap lookup per call, keyed by the `entities` array). A slot is reused only for the same entity with `Object.is`-equal x, y, z, half width and height; otherwise the slot gets a fresh array. An array already handed out is never written, so a sweep that kept a box still sees its own tick's numbers. This makes the server-dispense `targets()` list (every mob, for every ball, potion and arrow sweep, every tick) allocate only the small `{ ref, box }` record for a mob that has not moved. I kept the edit out of server-dispense.js entirely (mpthrown84's file): the saving is inside `mobTargets`, which `targets()` calls.
  2. `moveSpeedQuick`: entities.js `aiMoveSpeed` skips the six temporary modifier arrays, `liveAttribute`'s filter/map and the spread when the mob has no stored modifiers, effects or transient flags (baby, speedBoost, pigTarget, drinking, sprinting). Anything else takes the old body (`aiMoveSpeedReference`). The clamp is the same `min(max, max(0, base))` as `attributeValue` with an empty list.
  3. `stepBlockInto`: step-block.js writes `stepBlock`'s answer into a caller scratch; mob-steps.js `mobStepEvents` reads the fields at once (the `replaced` flag is read into a local before `onWalk`).
  4. Unflagged: `moveEntityBody`'s seven and the item `move`'s three `for (const o of list)` loops became indexed loops (same order and arithmetic, no iterator object).
- Also fixed a b83 verify false positive: `mobTargetList` compared dragon parts' `reach` closures by identity (a fresh closure per call), so `MC_MPPERF83=verify` threw on every dragon test (dragon-sweep, dragon-projectile part tests). It now compares `typeof`.
- Not done: `size()`'s `[w, h]` (the hot callers already use `sizeInto`; the rest are spawn, mount and client paths, and the tracker's `(m) => this.size(m)` closures belong to tracker files this batch), megamorphic `e.x` loads (no safe win found beyond b82/b83's reads-once).
- Files: `src/mpperf84-fast.js`, `src/projectiles.js` (import, `mobTargets`), `src/entities.js` (import, `aiMoveSpeed`, loops), `src/item-entities.js` (loops), `src/step-block.js`, `src/mob-steps.js`, `src/mpperf83-fast.js` (the reach compare), `tools/bench-alloc81.mjs` (prints `mode84`), `src/mpperf84-b84.test.js` (5 tests).

## Evidence
- Executed, `tools/bench-alloc81.mjs` (3 runs, 150 ticks, load modest): travel off 4.80 / on 4.83 ms per tick, heap 2373 -> 2359 KB/tick; pen 0.97 / 1.09 ms, 822 -> 781 KB/tick. Wall time is noise. The scenes have no balls, so `targets()` is not exercised by them.
- Executed microbenchmark of `mobTargets` x 8 balls per tick (scratch script, 150 ticks): pen (200 still cows) 251 -> 123 KB/tick, 0.027-0.039 -> 0.035-0.036 ms; travel (260 moving mobs) 419 -> 306 KB/tick, 0.13 -> 0.13-0.17 ms. A first version keyed on a WeakMap per mob was slower (0.14 vs 0.10 ms), so the cache is by list slot.
- Executed `--state` hashes (travel, pen, terrain; 150 ticks): off, on and verify (with `MC_MPPERF83=verify`) are identical.
- Port-read: no game rule changed; no 1.7.10 bytecode read.

## Verification
- `node --test src/mpperf84-b84.test.js`: 5 pass (cached boxes through moves, -0, NaN, calf growth, list shift; aiMoveSpeed on every ENTITY_TYPES entry with and without modifiers; stepBlockInto; seeded hashes off/on/verify).
- Neighbour set (45 files) with `MC_MPPERF84=verify MC_MPPERF83=verify` and with default mode: see the result lines in the final report.
- No full npm test, no browser checks.

## Follow-ups
- Build the lane target list once per tick (needs invalidation on hits that move or kill a target) if ball counts ever matter.
- `mobTargets` still allocates a `{ ref, box }` record and a one-element list per mob.
- Megamorphic `e.x` loads in tickMobs; tracker `track`/`stateDiffs` (mpboat84's files).
- Browser-only: the client also calls `mobTargets` (thrown balls, arrows) and `mobStepEvents`; frame time unchecked.

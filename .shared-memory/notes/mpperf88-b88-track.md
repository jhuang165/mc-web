# Batch 88 mpperf88: mob number fields, hot for-of loops, departed watcher stamps, target numbers

## Summary
- Added `src/mpperf88-fast.js`, with the flag `MC_MPPERF88=on|off|verify`.
  - The default is on. In verify mode both paths run, and the first difference throws.
  - The module has no imports. `tools/bench-alloc81.mjs` now prints `mode88`.
- Item 1: one stable field representation for the mobs' numbers (`mobShape88`, called at the end of `entities.js` `create`).
  - **Why.** The travel scene's 255 mobs have 27 hidden classes over 9 types (pen 2, terrain 39; executed with `%HaveSameMap`). A site that reads mobs of more than one type is megamorphic, and V8 copies a double field into a fresh HeapNumber on each megamorphic load.
  - **Cheapest fix that keeps game state.** A single shape for all types would change Object.keys, saves and `in` tests, so it was not done. Per-type unification still leaves more than 4 maps per site, so those sites stay megamorphic anyway.
  - **What it does.** Each listed number field (`MOB_NUMBER_FIELDS`: position, velocity, previous position, the yaw/pitch/limb fields, fallDistance, moveForward, aiMoveSpeed, knockbackResistance, health) is stored once as a frozen sentinel and then as its value again. This moves the field to the "any value" representation, so a load hands out the stored number without a copy. A store of a fresh double allocates once, but these fields are read far more often than they are written.
  - Keys, their order and every value (-0 and NaN too) are unchanged. Verify checks this after each call. A missing field is never added.
  - Subsets measured (travel heap, executed): x/y/z only 1758 KB/tick, the nine position and velocity fields 1691, the full list about 1530 (off is about 2190). "Every numeric field" was no better than the list.
- Item 2: the `next` builtin. It came from for-of and destructuring in functions that run unoptimised or in deopt windows. The array iterator protector is intact (checked). Index loops and `Map.forEach` avoid it in every tier.
  - `bow.js` step: the arrow's target filter (`arrowNear88`). Off, a non-array list and verify still run the for-of; verify compares both lists.
  - `server-mobs.js` track: the packet-list reset and the state-row loop are index loops. The row body moved to the module function `stateRow`, shared by both modes.
  - `server-chunk-view.js` tick: `players.forEach` over a new `tickOne(id, p)` with the old body. `nativePos` is read by index (`np[0]`, `np[1]`) in both modes.
  - `server-hanging.js` track: `views.forEach` over `trackOne88`, with an index loop over `live`. The stale-key pass runs only when `known.size !== seen.size` (seen is a subset of known after the loop, so equal sizes mean nothing to delete). Deleting the visited key inside `Map.forEach` visits the rest in the same order as the copied key list.
  - `server-chunks.js` `ServerChunkSets.chunks` and `server-dispense.js` flush's per-lane player filter: `players.forEach`.
  - `server-dispense.js` snapshot: returns its empty list early when primed TNT, fireballs, golem snowballs and wither skulls are all empty. The loops below would add nothing.
- Item 3: a departed watcher's stamp slots (`releaseWatcher88`, one new line in `server-mob-entries.js` `removeWatcher`, track88's file).
  - For each entry: the shared destination snapshot (`snap`) is dropped if it names the watcher; destinations() makes a fresh one with the same members when asked.
  - The EntryStamps are reset (packet list empty) or compacted to the live packets, and every slot past `n` is cleared (packet and destinations undefined, seq 0).
  - Verify compares every live packet's stamp and destinations before and after. The cost is one pass over the entries per departure.
- Item 4: the next largest allocator after the loops, `projectiles.js` `mobTargets` (mpperf87 `mobTargetAt` kept a per-mob cell object with five doubles).
  - `mobTargetAt88` keeps the numbers in a Float64Array (5 per mob, grown by doubling) in a side store hung off mpperf84's box store (WeakMap). The box is kept while all five numbers match (Object.is semantics, so 0 and -0 differ); the record is kept while `ref` and `box` match and nobody set `thrower`.
  - Used only when mpperf87 and mpperf88 are both on. Verify checks the record keys and the box numbers.
- `entity-tracker.js` and `copy-meta.js`: unchanged.

## Evidence
- Executed: `node --expose-gc tools/bench-alloc81.mjs --scene=X --runs=5 --ticks=150`, final pass at load about 7.5–8. Earlier passes at load about 4–5 gave the same heap numbers.

  | Scene | Heap KB/tick, off -> on | Change | ms/tick (median), off vs on |
  |---|---|---|---|
  | travel | 2193 -> 1542 | -30% | 3.82 vs 3.84 |
  | pen | 587 -> 550 | -6% | 0.83 vs 0.82 |
  | terrain | 1139 -> 751 | -34% | 2.46 vs 2.46 |

  Earlier passes: travel 2180 -> 1525, pen 586–592 -> 553, terrain 1138–1144 -> 747–751. Tick time is within noise in every scene (an earlier terrain pass gave 2.84 / 2.65 off vs 2.57 / 2.79 on). GC count per tick fell (travel 0.15 -> 0.11, terrain 0.07 -> 0.05).
- Executed heap sampling, travel (`--heapprof`, total MB over 150 ticks):

  | Stage | Total | `next` | mob targets |
  |---|---|---|---|
  | Baseline (runs=1, cold) | 452 | 25.9 | 17.6 (`mobTargetAt`) |
  | Item 1 (runs=1) | 325 | 25.7 | 15.7 |
  | Item 1, warm (runs=3) | 269 | 14.9 | 15.7 |
  | Item 2 loops | 263.6 | 10.1 | 15.6 |
  | Item 4 | 257 | 9.6 | 10.1 (`mobTargetAt88`) |

  - `next` still left (MB): thrown-tracks update 1.85 (track88), server-vehicles track 0.87 (boatray88), the rest of dispense flush 0.56, `simulation.js` tick's player loop 0.46, server-chunks `ChunkSet.chunks` 0.46 (a one-off order rebuild).
  - Largest allocators now: moveEntityBody 7.4, moveWith 7.2, the inlined `get ai` sites 6.9, updateAITasks 6.6, FineGrid 6.5, blockBoxesFast 6.1.
- Executed `--trace-deopt`, terrain: 178 bailouts -> 155. push87's "wrong map" deopts went from 9 to 7; the rest come from warm-up polymorphism.
- Executed `--state` hashes at 50/100/150 ticks, identical in off, on and verify (verify with MC_MPPERF83..88 all set to verify):
  - travel `cb8b2d257c3cf1f2,5578a1c033642b20,398225aef3512825` (differs from the b87 note because other b87 tracks merged since; it matches this branch's base);
  - pen `bb29fa50fa1455e2,299f5b68c2b695ca,a0f2782811dd9f8b`;
  - terrain `869ae5624b68bf08,de7a76e322120b55,8ea5d7de52247bf9`;
  - `tools/bench-server-mobs.mjs --state`: `7dabd87716b618ad,3217bef0811c28df,e5daebec30bc3fc4`.
  - The bench's `drain` discards `chunkOut`, so the chunk-view change is covered by the moving-player scene test instead (see Verification).
- Port-read: no game rule changed and no bytecode was read. Every change rewrites an existing port path's allocations or loop and has a verify comparison.

## Verification
- `node --test --test-timeout=600000 src/mpperf88-b88.test.js`: 9 pass, 0 fail. It covers:
  - mobShape88 keys, order and values (-0, NaN, non-numbers, missing fields) in on/verify/off;
  - EntityWorld.create for 20 types: same keys and values off/on/verify (uuid excluded: not seeded);
  - arrowNear88 against the for-of filter, including the order of `reach` calls;
  - releaseWatcher88 on EntryStamps (reset, compaction, cleared tail, live stamps kept, snapshot dropped only when it names the watcher, stamps usable afterwards) and off as a no-op; a SharedEntry after a release;
  - mobTargetAt88 against mpperf87 `mobTargetAt` (150 mobs, growth past 64, reuse, a `thrower` record replaced, -0 as a move, another mob at the same index) and mobTargets off/on/verify;
  - ServerHanging.track off/on/verify with players joining, leaving, moving out of range and changing dimension, a dead painting, a changed painting and a removed knot;
  - a seeded 4-player scene (Math.random seeded, 3-chunk view, players moved by hand, one leaves at tick 30): every chunkOut, mobPackets, vehPackets and dispOut hashed the same off/on/verify, with chunk unloads asserted;
  - seeded pen and terrain bench hashes in three modes, with MC_MPPERF83..87 also verify.
- Neighbour tests (`--test-concurrency=4`), default mode: 386 pass / 0 fail over 31 files (mpperf77–88, bow, entities, entities82, projectiles 1/3/4/5/6, hanging, mppaintings, mpknots77, leash, mobs84, blastcover86, fire-times-b53, skins73, sounds73, skintex75, module-names), and 298 pass / 0 fail over 33 multiplayer files (chunk view, streaming, dispense lanes, thrown, trackers, smallchecks, offline87, sptrack87 and others that touch hset/hdel, chunkUnload, removeWatcher or dispEnts).
- With MC_MPPERF88=verify: 338 pass / 0 fail over 31 of those files.
- Source-text checks on edited files (mobs84 on entities.js, blastcover86 on server-dispense.js, fire-times-b53 on bow.js) still match; none needed changes.
- Old tests updated: `src/mpperf86-b86.test.js` and `src/mpperf87-b87.test.js` match the bench line, which now prints `mode88` after `mode87`; their regexes accept an optional `mode88=…`.
- `npm run build` passes, with the existing chunk-size warning. No full npm test was run, and there were no browser checks.

## Follow-ups
- `next` loops in other tracks' files: thrown-tracks update (track88), server-vehicles track (boatray88), simulation.js tick's player loop (shared, large).
- Mobs made by `EntityWorld.restore` (loaded saves, `/summon` with a record) are not shaped. restore is the mob save code entnbt88 is editing this batch; one `mobShape88(...)` around its result would cover it.
- Allocators now leading: moveEntityBody, moveWith, the inlined `get ai` sites, updateAITasks, FineGrid, blockBoxesFast.
- Browser-only: single-player frame time and GC pauses with the tagged fields (the browser runs the same `create`), and multiplayer client behaviour over a real WebSocket.

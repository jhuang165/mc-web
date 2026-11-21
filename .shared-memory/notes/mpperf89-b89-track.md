# Batch 89 mpperf89: last hot for-of loops, restored mob shapes, two allocators, EntityAITasks CPU

## Summary
- Added `src/mpperf89-fast.js`, with the flag `MC_MPPERF89=on|off|verify`.
  - The default is on. Off runs the reference paths. Verify runs both where both can run, and the first difference throws.
  - The module has no imports. `tools/bench-alloc81.mjs` now prints `mode89`, and takes `--cpuint=us` (the CPU profiler's sampling interval) for finer CPU profiles.
- Item 1: the for-of loops left in per-tick server paths. Every edit in another track's file is on its own line(s).
  - **`multiplayer/thrown-tracks.js` update** (mobpackets89's file).
    - Five loops converted to `eachValue89` (Map.forEach): the players loop, the three watcher loops and the `out` loop.
    - Six insert-only guard lines (`if (fast89.mode === 'off' || <cond>)` before the unchanged loop) skip a loop when it would do nothing:
      - `late.length`;
      - `leftAny89` (some watcher's player is gone);
      - `anyGone89` (some tracked entity is not alive);
      - `look.length`, twice;
      - `anyNew89` (some listed entity is untracked).
    - The skipped loops include the `[...this.watchers]` and `[...this.objs]` copies.
  - **`multiplayer/server-vehicles.js` track** (mpobjects89's file). Five insert-only guard lines:
    - `all.length`, twice;
    - `view.known.size !== seen.size`. Every seen key is in `known` after the loop because keys are unique (`'b'|'c' + id`), so equal sizes leave nothing to delete. This is the b88 hanging argument.
    - `leaving.length`;
    - `vis.size`.
    - The per-view `for (const [id, view] of this.views)` loop is unchanged. Its body uses `continue`, and converting it means moving about 30 lines of another track's code.
  - **`multiplayer/simulation.js` tick.** The player loop and the two `settle` loops now go through `eachValue89(this.players, …)`. The player loop's header and closing lines changed; the body is untouched and has no continue, break or return.
  - **`eachValue89` semantics.** Map.forEach visits entries added during the walk and skips entries deleted before they are reached, exactly as the Map iterator does. Off runs the for-of itself.
- Item 2: `EntityWorld.restore`.
  - One new line after the `install*()` calls in `entities.js`: `EntityWorld.prototype.restore = restoreShaped89(EntityWorld.prototype.restore, mobShape88)`.
  - The wrapper sits outside the dragon's `around("restore")` wrapper, so the record it shapes is final.
  - It covers saved worlds, java-mobs imports, `/summon` with a record, ridden mounts (`entities.js` 1587/1616) and server horse spawns.
  - mobShape88 itself still does nothing with MC_MPPERF88=off. Verify compares keys, order and values (Object.is).
- Item 3: two allocators fixed without changing state.
  - **(a) `Brain.updateAITasks` cleared `senseCache` every tick.**
    - Executed microbench: `Map.prototype.clear()` on an empty Map allocates about 57 B and costs about 36 ns, inside a C++ builtin that the profile charges to the JS caller. A guarded call costs 1.1 ns and 1.9 B.
    - An insert-only guard line (`size !== 0`) now precedes each clear: `ai.js` 1252, `entities.js` 3259 and 3318 (the legacy think paths), and `legacy-creature.js` 51.
  - **(b) The `ai` getter on EntityWorld.**
    - Its MobAI dependency closures capture `this`. V8 therefore creates a function context on every call, even when `mobAI` already exists (bytecode-read with `--print-bytecode`: `CreateFunctionContext` at entry).
    - The old body is now `makeAI89()`. A new one-line `get ai()` returns `mobAI` through `aiOf89` without entering it. Off calls `makeAI89()`; verify checks that both give the same object.
    - Measured gain is uncertain. The sampling heap profile charges `get ai` anywhere from 0.1 MB to 6.5 MB per 150 travel ticks, depending on whether callers inline it (escape analysis can drop the context).
  - **Not fixed.**
    - moveEntityBody also creates a 4-slot context at entry, from its `sneakEdge` closure (bytecode-read). Removing it means restructuring the function, which cannot be switched by a flag at run time.
    - moveWith, FineGrid (a new grid plus `new Array(n)` per query) and blockBoxesFast (box pool and list) produce boxes and lists that callers keep. They were left alone.
- Item 4: CPU (executed `--cpuprof`, travel and terrain, with and without `--no-turbo-inlining`).
  - **The profile is flat.** The largest self-time function is tickMobs, at about 6.5–8% (plus about 3% charged to its `tick` wrapper). Its line profile is spread over megamorphic `e.field` reads: 28 maps over 9 types in travel, which differ only by lazily added `nextStep` and `velocityChanged`. Unifying them would change keys and saves, so tickMobs was not changed.
  - Next by self time: moveEntityBody, moveEntityWithHeading, updateAITasks, `ai.js` TaskList.tick and canUse, then world.get/chunkAt/inside (about 6% in total, in core `world.js`).
  - Inclusive: walk 42%, mobThink 27%, updateAITasks 21%, EntityAITasks tick 13.5%.
  - **Taken: TaskList (EntityAITasks, uj).**
    - `canUse` walked every task and asked `running.includes` for each, which is O(tasks × running). `canUse89` walks only the running tasks, because a task that is not running never refuses. A refusing task counts only while it is still in `entries`: a task removed during tick's own walk can be pushed to running afterwards, and the reference never asks it. isInterruptible has no side effects (only Task defines it).
    - `tick` runs as `taskTick89`: the same steps with index loops (a for-of over an array reads the live length and index the same way). `started` is allocated only when a task starts, and the updateTask snapshot copy is taken only for 2 or more running tasks.
    - In ai.js this is one insert-only line at the top of canUse and one at the top of tick.
  - The for-of `next` that TaskList.tick showed once canUse stopped inlining (0.57–0.70 MB per 150 travel ticks) is gone with taskTick89.
- `entity-tracker.js` and `copy-meta.js`: unchanged.

## Evidence
- Executed: `node --expose-gc tools/bench-alloc81.mjs --scene=X --runs=5 --ticks=150`. Off and on were alternated, three pairs per scene, at load about 3.5–5.

  | Scene | Heap KB/tick, off -> on | Change | ms/tick (median of 3 medians), off vs on |
  |---|---|---|---|
  | travel | 1515 -> 1431 | -5.5% | 3.66 vs 3.60 |
  | pen | 555 -> 482 | -13% | 0.82 vs 0.79 |
  | terrain | 758 -> 711 | -6% | 2.21 vs 2.24 |

  - Run medians: travel off 3.73 / 3.60 / 3.66, on 3.60 / 3.60 / 3.56; pen off 0.82 / 0.83 / 0.80, on 0.79 / 0.78 / 0.80; terrain off 2.20 / 2.26 / 2.21, on 2.19 / 2.30 / 2.24.
  - An earlier pass at load about 6 gave the same heap numbers, with tick times too noisy to read (travel on 3.77 and 5.68).
  - Tick time is within noise for terrain and slightly lower for travel and pen. This is not a claimed speed-up.
- Executed CPU profiles (`--no-turbo-inlining --cpuint=250`, 3 runs of 150 ticks), self ms, off -> on:

  | Function | travel | terrain |
  |---|---|---|
  | canUse (+canUse89) | 6.1 -> 3.5 | 1.9 -> 1.0 |
  | updateAITasks | 12.7 -> 8.4 | 7.4 -> 5.7 |
  | TaskList.tick | 8.8 -> 6.5 | 7.2 -> 5.0 |
  | tickMobs | 47.5 -> 45.6 | 27.7 -> 23.3 |

  The tickMobs row is noise; it was not changed.
- Executed heap sampling, travel (`--heapprof`, MB per 150 ticks, two runs per mode):
  - totals: 297 / 295 -> 289 / 288;
  - updateAITasks: 6.6 / 6.9 -> 3.5 / 3.6;
  - thrown-tracks update `next`: 1.05 / 1.01 -> below the listing;
  - server-vehicles track `next`: 0.81 / 0.79 -> 0.45 / 0.42 (the per-view loop stays).
- Executed `--state` hashes at 50/100/150 ticks, identical in off, on and verify (verify with MC_MPPERF83..89 all set to verify):
  - travel `febe9c2375771ef4,ac04413045517049,2b979d02e3eb2b4d`;
  - pen `5237cade2b7c42ae,299f5b68c2b695ca,a0f2782811dd9f8b`;
  - terrain `31251f8219227278,de7a76e322120b55,8ea5d7de52247bf9`;
  - `tools/bench-server-mobs.mjs --state`: `f6536e8abe98d3e0,3217bef0811c28df,e5daebec30bc3fc4`.
  - These match this branch's base (6cd02f772). They differ from the b88 note's hashes because other b88 tracks merged since.
- The travel bench has skeleton arrows in the thrown tracker (about 8 objects and 16 watchers per tick), but no vehicles, player throws, departures or restored mobs. Those paths are covered by the seeded scene test instead (see Verification).
- Port-read: no game rule changed and no 1.7.10 bytecode was read. The V8 facts are executed (microbenchmarks, profiles) or bytecode-read from V8's own `--print-bytecode` output. Every change rewrites an existing port path's loops or allocations and has a verify comparison or an off/on equivalence test.

## Verification
- `node --test --test-timeout=600000 src/mpperf89-b89.test.js`: 10 pass, 0 fail. It covers:
  - eachValue89 against for-of for Map, Set and array, with entries added and deleted during the walk;
  - leftAny89, anyGone89 and anyNew89 against brute force;
  - canUse89 against the reference, over 500 random task lists, including a running task no longer in the list;
  - TaskList.tick call logs and running lists off/on/verify, also with tasks that remove or add tasks during the walk;
  - restore of 20 mob types (dragon included) giving the same keys and values off/on/verify, with the dragon wrapper still applied;
  - restoreShaped89 for null, off and a verify failure;
  - one MobAI per world through the getter;
  - a seeded 4-player scene with snowballs thrown every 4 ticks, a boat and a cart per player, six mobs restored /summon-style at tick 12 and one player leaving at tick 30. Every chunkOut, mobPackets, vehPackets and dispOut, plus the final mob records (uuid excluded), hash the same off/on/verify.
  - seeded pen/terrain bench and bench-server-mobs hashes in three modes.
- Mutation check (executed): making `anyNew89` always false, or dropping the single-task updateTask, fails the scene test and the TaskList test.
- Neighbour tests (`--test-concurrency=3`), default mode: 516 pass / 0 fail over 45 files. These are mpperf77–89, mplos76, eye-height, legacy-ai, legacy-body-b50, ai, mob-doors, village-ai, villager-polish, zombie-door, village-aggressors, mpthrown84, mphook85, lanes86, sptrack87, track88, mpboat84, mpvehicles(3), tracker83, boatcheck87, summon86/87, entnbt88, multiplayer, simulation-replay, mpsleep, mpstats, spcopy85, skins73, sounds73, skintex75 and module-names.
- With MC_MPPERF89=verify: 169 pass / 0 fail over 18 of those files. With MC_MPPERF89=off: 64 pass / 0 fail over 8.
- Old tests updated:
  - `src/mplos76-b76.test.js` regex-checks `ai.js` for `this.despawnEntity();` directly followed by `this.senseCache.clear();`. It now allows the guard line in between.
  - `src/mpperf86-b86.test.js`, `src/mpperf87-b87.test.js` and `src/mpperf88-b88.test.js` match the bench line, which now prints `mode89` after `mode88`.
- `npm run build` passes, with the existing chunk-size warning. No full npm test was run, and there were no browser checks.

## Follow-ups
- **Found, not fixed (behaviour, out of scope):** `multiplayer/simulation.js` line 657 has `p.resendCells = null;` inside the trailing `// b61: …` comment. resendCells is therefore never cleared (except on a dimension change in `server-dimensions.js`): once a refused edit queues a cell, that player gets `p.blocks` rebuilt and resent every tick, and the list keeps growing. Port-read, not run in a client.
- server-vehicles' per-view loop (`for (const [id, view] of this.views)`, 0.4 MB of `next` per 150 travel ticks). It needs a per-view method, as server-hanging's `trackOne88`.
- tickMobs and walk are bound by megamorphic mob field reads. The only state-safe lever found is fewer hidden classes. `nextStep` and `velocityChanged` are added lazily; giving them a fixed slot would change Object.keys and saves.
- moveEntityBody's per-call context (from the `sneakEdge` closure), FineGrid's per-query arrays, mobTargetAt88's per-move box, and world.get/chunkAt/inside (about 6% self, in core `world.js`).
- Browser-only: single-player frame time with the getter, sense-cache and TaskList paths (the browser runs the same `entities.js`/`ai.js`), and multiplayer clients receiving thrown and vehicle packets over a real WebSocket.

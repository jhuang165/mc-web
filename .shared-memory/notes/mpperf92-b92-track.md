# Batch 92 mpperf92: target box store survives the tick, shared path finder, pooled memo table

## Summary
- New `src/mpperf92-fast.js` with `MC_MPPERF92=on|off|verify` (default on). `tools/bench-alloc81.mjs` prints `mode92` after `mode91`; the `mode91=` regexes in the mpperf86..90 tests allow `mode92=`.
- Finding (executed, profiled): `tickMobs` ends with `this.entities = kept` (a filtered copy, every tick), and the box store of b84/b88 is a WeakMap keyed by that array. So the store, its boxes and its records were thrown away every tick and rebuilt at the first sweep of the next one: cross-tick reuse never happened, which is why `mobTargetAt88` allocated 10 MB per 150 travel ticks. The aliasing worry of b90/b91 only applies to reuse across ticks, which did not exist.
- `src/mpperf84-fast.js`: `carryBoxStore(from, to)` moves the store to the new list. `src/entities.js` `tickMobs`: `carryTargets92(this.entities, kept)` before the swap, and `bumpTargetEpoch92(boxStore(this.entities))` at the start of the tick. (The every-20-ticks despawn filter in streaming worlds still drops the store once; harmless.)
- `mobTargetAt92` (projectiles.js `mobTargets` calls it, off falls back to `mobTargetAt88`): same record and box as 88. When a mob has moved, its box is rewritten in place only if that box was last handed out before the current tick's epoch bump; a box handed out in this tick (a teleport moving the mob between two lists of one tick) is replaced as before, so within a tick "a handed-out array is never written again" (b84) still holds. A store with no mob tick yet (epoch 0) never rewrites. The record is kept with its box (the `thrower` rule of b87 unchanged).
- Holders audited (Port-read): every `mobTargets` caller (server-dispense `targets`, away-entities, entity-list-replay, village-fight-replay, main.js hooks, server-fishing, witch-potions, mooshroom-golem-live) builds its list per call and drops it before the next mob tick; the only record kept past a call is the pearl `onPearlImpact({ target })`, consumed synchronously. Marking a record (`thrower`) replaces it on the next call. Nothing was copied because nothing holds a box across a tick.
- `src/pathfinding.js`: `PathNavigate.finder()` hands out one module-level `PathFinder` reset to what a new one holds (world, flags, classify, maxNodes, empty heap count, nulled 32 option slots, counters, `tries`), instead of a new finder + 1024-slot heap array + option array + options object per search; a finder with a memo open (a search inside a search) is never handed out again, a fresh one is built then. `beginMemo` keeps its `n^3` page table per size in a pool and `endMemo` nulls only the slots the search used (tracked in `memo.slots`); an open table of the same size gets a new one. Not shared: `blaze-ghast-mobs.js` builds its own finder.
- Not changed: `legacyThink` (5 MB: stores into `silverfishState` fields), `tickMobs` field shapes (keys/saves), `next`/`set`/`push` builtins (callers not attributable in a heap profile), `blockBoxesFast`, `FineGrid`, `explosionBlocks`, `moveEntityBody`.

## Evidence
- Executed heap profile (travel, 150 ticks, MB) before: mobTargetAt88 10.05, blockBoxesFast 5.9, legacyThink 5.2, finder 4.4, beginMemo 4.2, Path 3.9. After: none of mobTargetAt, finder, beginMemo, Path in the top 22.
- Executed `node --expose-gc tools/bench-alloc81.mjs --scene=X --runs=3 --ticks=150`, off/on alternated:

  | Scene | heap KB/tick off -> on | ms/tick off -> on |
  |---|---|---|
  | travel | 1454 -> 1379, 1448 -> 1319, 1455 -> 1398, 1448 -> 1318 (about -6 to -9%) | 6.24 -> 9.04 (outlier run), 5.85 -> 5.21, 8.58 -> 5.30, 6.28 -> 5.60 (noisy, shared Mac) |
  | terrain | 770 -> 682 (-11%) | 3.47 -> 3.98 (noise) |
  | pen | 433 -> 431 | 1.63 -> 1.58 |

  Tick time is inside the noise; only the allocation drop is claimed.
- Executed `--state` (150 ticks): travel `f81ade75de17a1ed,ff999ef463b1dfa9,d5aa46cad2ae3123`, pen `57dd8fa8bdd4d102,299f5b68c2b695ca,a0f2782811dd9f8b`, terrain `d1f7bb76960f7d5a,9607f5be7082399a,74cf6254ce283594`: identical off, on, verify (terrain off/on/verify too).
- Verify mode: mobTargetAt92 checks the box numbers, key count and record shape against a fresh array; `finder()` compares every field with a new PathFinder; the memo table is checked empty at each `beginMemo`.

## Verification
- `node --test src/mpperf92-b92.test.js`: 6 pass (scripted moves inside a tick vs after a mob tick, epoch 0 never rewrites, -0, slot change, carry on/off, all 30+ probe paths off/on/verify via `PathNavigate.finder()`, shared finder and pooled memo, bench hashes pen/travel off/on/verify; Math.random is seeded by the bench in every mode). Mutation (executed): dropping the epoch condition fails tests 1 and 2.
- Neighbours: every test file naming pathfinding, projectiles, mobTargets, PathNavigate/PathFinder, tickMobs, boxStore or mpperf80..92 (84 files, concurrency 2): 868 pass / 0 fail. `npm run build` once: ok. No full npm test, no browser.

## Found wrong in the batch 91 list
- "mobTargetAt88 box churn cannot reuse without aliasing": the churn was not from moved mobs but from the store being lost every tick (see Summary); carrying it removes most of it, and in-place rewriting is gated per tick.

## Follow-ups
- Still open: `legacyThink` allocations, `tickMobs` shapes, `walk`, `next`/`set`/`push` builtin allocators. A held `finder()` result across a second `finder()` call would alias (no caller does; tests build their own). Single-player frame time is browser-only.

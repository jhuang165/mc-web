# Batch 86 mpperf86: track packet copies, walk, item physics

## Summary
- New `src/mpperf86-fast.js` (`MC_MPPERF86=on|off|verify`, default on; verify runs both paths and throws on the first difference; no imports). `tools/bench-alloc81.mjs` prints `mode86`.
  1. `server-mobs.js` `track`: packets go out in packetSeq order through a reused slot array keyed by stamp (`seqOrder`), with no `[seq, entry, packet]` triple per packet and no comparator sort. Duplicate stamps, non-integer stamps or a span over 4n+256 fall back to the sort. Over 100 travel ticks the slot path was taken every tick.
  2. `track` per-watcher copies: a packet with none of entity/vehicle/holder/after is spread whole (`{ ...pk, i }`), so the `...rest` object is gone. Attach packets keep the reference body. The wire number is cached per entity and keyed on `e.id` (`wireNum`). A resent state string whose values are all primitives is parsed once into a cache (`parsedState`). The cached object is only spread and never handed out, and nested values are parsed fresh.
  3. `stateDiffs86`: mpperf77 stateDiffs using `forEach`, which avoids Map entry pairs and Set iterators. The lists come out in the same order.
  4. `entity-tracker.js` `walk()`: one indexed pass over the JavaHashSetOrder table, with no `keys()` array and no filter array. The old body is kept as `walkReference()`. `serverTick` and `server-mob-entries.js` `serverStep` reuse one walk list for the location pass and for every flagged watcher's pass, since those passes neither add nor remove entries. The removal sweep uses `Map.forEach`.
  5. `item-entities.js` (behind the flag, real `World` only):
     - `move` collects collision boxes into pooled scratch boxes. This uses a new `mpperf81-fast.js` `constCellTable`, the same probe as `cellBoxesOf` with its own table.
     - `move` moves a scratch box. `webMove` is called only in a web.
     - `burn`'s lava test reads six numbers (`lavaIn`).
     - `tickOne` skips `waterAcceleration` when no water cell touches the item box. The push is zero then, and `+= 0` keeps the -0 handling.
- `copy-meta.js` unchanged.

## Evidence
- Executed, `node --expose-gc tools/bench-alloc81.mjs --runs=3 --ticks=150`. The machine was loaded (load about 13), so wall time is noise.

  | Scene | Heap KB/tick, off -> on | Change | ms/tick, off vs on |
  |---|---|---|---|
  | travel | 2501 -> 2377 | -5% | 5.90 vs 6.31, run spreads overlap |
  | pen | 753 -> 705 | -6% | 1.42 vs 1.17 |
  | terrain | 1327 -> 1254 | -5.5% | 3.50 vs 3.38 |

- Executed heap sampling, travel, MB summed over 150 ticks:

  | Function | Before | After |
  |---|---|---|
  | `track` (inclusive) | 48.6 | 34.0 |
  | `serverStep` | 21.5 | 14.4 |
  | item `tickOne` | 17–27 | 13.6 |

- Executed `--state` hashes at 150 ticks, equal to the HEAD baseline:
  - travel, pen and terrain: off, on, and verify with MC_MPPERF83/84/85/86=verify.
  - The bench hash does not cover items. Item positions, motion, boxes and flags were hashed separately on travel (3517 samples): off and on both `da325508bfbe3149`.
- Port-read: no game rule changed; no bytecode read. Every change is an allocation or loop rewrite of an existing port path. Each one is checked by its verify compare against the reference path.

## Verification
- `node --test --test-timeout=600000 src/mpperf86-b86.test.js`: 6 pass, 0 fail. It covers:
  - seqOrder against the stable sort, plus the fallbacks;
  - the packet helpers;
  - stateDiffs86 against stateDiffs;
  - walk with a shared order and the player key;
  - item physics off/on/verify on a soup World;
  - seeded pen hashes in three modes.
- Neighbour files: 1350 pass, 0 fail across 103 files with `MC_MPPERF86=verify MC_MPPERF85=verify MC_MPPERF84=verify MC_MPPERF83=verify` (every test importing a touched file, mpperf77-86, tracker*). Default mode: 239 pass, 0 fail (mpperf8x, item-entities, entity-tracker, tracker-*, webs, lava, collide81, mpmobs).
- Source-text checks on the touched files (`pots82` `d.tags`, `clientreplays-b65` dragon sound) are unaffected.
- `npm run build`: passes (the existing chunk-size warning). No full npm test, no browser checks.

## Follow-ups
- Out-packet objects shared across watchers. This needs proof that no sink mutates a packet.
- Per-packet SEQ/dest WeakMap sets.
- `metaValues` in thrown-tracks.js (lanes86's file this batch).
- Mob simulation allocations in entities.js (`tickMobs`, `push`).
- Item merge-scan box destructure.
- `e.bxz` array per move. It stays fresh because items are spread-copied.
- `pushOut`'s `collisionBoxes`.
- Browser-only: the client single-player `serverTick`/`walk` path and the item physics in a real frame, which affect frame time and GC pauses.

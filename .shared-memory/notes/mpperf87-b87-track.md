# Batch 87 mpperf87: mob loop closures, item boxes, tracker stamps, shared packet copies

## Summary
- Added `src/mpperf87-fast.js`, with the flag `MC_MPPERF87=on|off|verify`.
  - The default is on. In verify mode both paths run, and the first difference throws.
  - The module has no imports. `tools/bench-alloc81.mjs` now prints `mode87`.
- Item 1: `entities.js` `tickMobs` and `push`.
  - **Closures moved out of the loop.** The mob loop's closures are now module functions (`mobThink`, `riddenThink`, `vehicleFallOf`, `mobEffects`), so the loop body creates no per-mob block context.
  - **AI step.** `walk()` is now passed a sentinel (`MOB_THINK`) and calls `mobThink` itself.
  - **Potion hooks.** The hooks are built only for a mob that has effects. Without effects, only `entityRandom(e)` runs. `tickMobEffects` returns straight away when there are no effects, but its random was always created.
  - **`attackEquipment`.** The previous array is reused while the slots hold the same ids (`attackEquipment87`). Only arrays made by this function are reused. combat.js and entities.js only read `.id`.
  - **`push87`.**
    - The candidate loop is indexed.
    - Frozen entities are skipped inside the loop, so `liveOrder` no longer filters a copy of the list.
    - The grid's verify-only `meets` closure is built only when the grid verifies.
    - The player's box is tested in place.
    - The tests run in the same order as before. In verify mode, push87 compares its pairs against the reference loop.
- Item 2: `item-entities.js`.
  - **Merge scan.** The boxes are tested in place, but only when `this.box` is the class's own. This removes two six-number arrays per candidate. The list is walked by index.
  - **`e.bxz`.** The array is kept when the moved box gives the same four numbers (`sameBxz`, which covers a resting item). Nothing writes into a bxz array; code only replaces it.
  - **`pushOut`.** The box goes into a scratch array.
  - **`entityPushOut`.** It asks "is there any collision box?" using moveEntity's scratch list and pooled boxes (`anyCollisionBox87`). A nested call falls back to the reference path.
- Item 3: tracker WeakMaps.
  - **EntryStamps.** A `SharedEntry` stores each packet's sequence number and destinations in an `EntryStamps` slot list beside `packets`. This replaces `SEQ.set` and `dest.set`, the two WeakMap writes per packet.
  - **Global ordering.** The sequence counter is still the global one (`nextPacketSeq`), so the order across entries is unchanged.
  - **Lookups in `track`.** `server-mobs.js` `track` reads the stamps through the entry (`seqOf87`/`destOf87`). mpperf86 `seqOrder` now also passes the entry to `seqOf`.
  - **Verify mode** writes the WeakMaps too and checks every packet's stamp and destinations against them.
  - `entity-tracker.js` only gains `nextPacketSeq` and `stampPacketSeq`. Plain `TrackerEntry` (single-player and tests) still uses the WeakMap.
- Item 3b: shared packet copies.
  - In `track`'s `plain`, a packet that is not a spawn is now copied once (`{ ...pk, i }`), and every watcher gets that one copy. Destroys go to `later`.
  - Spawns stay one copy per watcher.
  - Verify mode freezes the shared copy, so any sink that writes into it throws in strict module code.
  - Proof that no downstream code modifies a packet (port-read; the verify runs confirm it, see Verification):
    - `player.mobPackets` is only appended to (server-mobs.js), set to null (server-dimensions.js, server.js) or serialised.
    - server.js `send` runs `JSON.stringify` and the client parses its own copy.
    - The mpperf77-scene `drain` and the benches only hash or stringify it.
    - `v.destroys` is respread into the next tick's `out` array, which copies the array but not the packet objects.
    - `RemoteMobs.apply`/`state`, `ClientEntity.apply` and `applyCopyMeta` only read `p`. They only ever see packets that came through JSON in the app.
- Item 4: the largest allocators the profile named.
  - **`inWater`** was the largest self allocator in travel at the 0.115.0 baseline (18.8 MB per 150 ticks).
    - Its dry test now reads the entity's numbers itself (`dryEntity`, which is mpperf81 `noWaterIn` on the same box).
    - The zero `addVelocity` stores are skipped when they change nothing (`addZero`). `x + 0` is x except for -0, which still gets the store.
    - moveEntityBody's dry test uses `dryBounds` on the box array.
  - **`mobTargets`** comes next: the server-dispense arrow pass's target list, once per tick.
    - Sizes are now worked out in place (`mobTargetAt`), with mpperf84's box store read directly.
    - The record stays with its box while the mob has not moved and no caller has marked it with `thrower`. The callers that add `thrower` (server-dispense.js, witch-potions.js, mooshroom-golem-live.js) each do so straight after the list is made.
- `copy-meta.js`: unchanged. `applyCopyMeta` was confirmed to only read its packet.

## Evidence
- Executed: `node --expose-gc tools/bench-alloc81.mjs --scene=X --runs=3 --ticks=150`. Load average was about 4–5.

  | Scene | Heap KB/tick, off -> on | Change | ms/tick (median), off vs on |
  |---|---|---|---|
  | travel | 2351 -> 2175 | -7.5% | 3.69 vs 3.65 |
  | pen | 721 -> 588 | -18% | 0.83 vs 0.77 |
  | terrain | 1258 -> 1180 | -6% | 2.39 vs 2.38 |

  A second set of runs gave travel 2352 -> 2189, pen 716 -> 609 and terrain 1253 -> 1187. Tick time is within noise everywhere except pen, which is about 5% faster.
- Executed heap sampling, travel. Self MB over 150 ticks, comparing the 0.115.0 baseline with now:

  | Function | Before (MB) | After (MB) |
  |---|---|---|
  | `inWater` | 18.8 | 3.7 + `dryEntity` 3.8 |
  | `tickMobs` | 18.3 | 9.9 |
  | `push` | 17.5 | `push87` 11.3 |
  | `plain` | 8.5 | 1.0 |
  | `moveEntityBody` | 12.0 | 8.5 |

  - SharedEntry `emit` went from 0.8 to 0.2, and `emit87` adds 2.6.
  - mobTargets is about the same in travel, where every mob moves every tick: `mobTargetList` + `mobBoxAt` was 14.9 MB, and `mobTargetAt` + `mobTargetList` is now 17.9 MB, which is within sampling noise.
  - In an executed microbench with standing mobs (297 mobs, 2000 calls), mobTargets went from 120 MB to 64 MB. Most of the drop came from removing `mobBoxAt`'s `Object.is` calls on doubles, which boxed both sides.
- **Finding** (executed: `--trace-deopt` and microbenches): much of what remains is V8 boxing doubles on megamorphic loads.
  - The mob objects have many hidden classes. Reading `e.x`, `e.y` or `e.z` through a megamorphic inline cache returns a fresh HeapNumber.
  - In terrain, `push87` deopts about 12 times per run ("wrong map", "Maps became deprecated"), and runs boxed until it re-optimises. That explains why push's self allocation fell only from 22.6 to 20.3 MB in terrain.
  - A real fix means giving mobs one stable shape, which is a cross-module change.
- Executed: `--state` hashes at 50/100/150 ticks.
  - All of the following are identical to the 0.115.0 (b95bfd9ac) baseline for travel, pen and terrain:
    - flag off;
    - flag on;
    - all of MC_MPPERF83..87 set to verify.
  - Baseline hashes:
    - travel `63682cad199ecf07,efdf2d9b0d304aba,46889dc1261d28f4`;
    - pen `bb29fa50fa1455e2,299f5b68c2b695ca,a0f2782811dd9f8b`;
    - terrain `869ae5624b68bf08,de7a76e322120b55,8ea5d7de52247bf9`.
  - The hash covers the mob packets, through `drain`.
  - `tools/bench-server-mobs.mjs --state` (packets plus pistons) also matches across off, on and verify: `0877fddcaa9c46c7,f8ea0cd95773e9c5,7609b95d93dfbc5e`.
- Port-read: no game rule changed, and no bytecode was read. Every change rewrites an existing port path's allocations or loop, and each has a verify comparison against the reference path.

## Verification
- `node --test --test-timeout=600000 src/mpperf87-b87.test.js`: 10 pass, 0 fail. It covers:
  - attackEquipment87, including reuse and arrays not made by it;
  - sameNum against Object.is, and sameBxz;
  - EntryStamps: newest stamp wins, reset and compaction;
  - SharedEntry stamps against the WeakMaps in on, verify and off;
  - shareDone freezing;
  - dryEntity and dryBounds against dryBox on a soup World;
  - addZero against `+= 0`;
  - mobTargets off/on/verify, with record reuse, a marked record and a moved mob;
  - item physics and merging off/on/verify;
  - seeded pen and terrain hashes in three modes, with MC_MPPERF83..86 also set to verify.
- Neighbour tests, with MC_MPPERF83..87 all set to verify: 1559 pass, 0 fail, across 115 files.
  - The files were: everything importing entity-tracker, server-mobs or server-mob-entries; mpperf77–87; the item and projectile neighbours; and the entity, horse, enderman, golem, mob-effects, riding and pushout tests.
  - Also included: the source-text checks `mobs84-b84` (entities.js) and `clientreplays-b65` (entity-tracker.js), and the module walkers skins73, sounds73, skintex75 and module-names.
- Default mode for the tracker subset (49 files): 678 pass, 0 fail, run after the EntryStamps change, and again in verify.
- One old test was updated: `src/mpperf86-b86.test.js` matched the bench line `/mode86=off mobs=/`. The bench now prints `mode87` in between, so the regex accepts an optional `mode87=…`.
- `npm run build` passes, with the existing chunk-size warning. No full npm test was run, and there were no browser checks.

## Follow-ups
- **Megamorphic mob shapes.** This is now the main allocator; the deopts and boxed loads are described in Evidence.
- **`push87` residual.** About 11 MB in travel and about 20 MB in terrain, mostly from the deopt cycle above.
- **`next` builtin.** About 23 MB in travel, from iterator steps in code that is not optimised.
- **Leftover EntryStamps slots.** They are kept for reuse. They can hold a departed watcher's destination array until the slot is overwritten. The amount is bounded by the entry count.
- **Browser-only checks:**
  - single-player `tickMobs`/`push`/item physics frame time and GC pauses in a real frame;
  - multiplayer client rendering with the shared packet copies over a real WebSocket. The data is the same JSON, but this was not exercised in a browser.
